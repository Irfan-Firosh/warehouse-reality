import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SCRIPT = fileURLToPath(
  new URL("./smoke-token-factory.ts", import.meta.url),
);
const KEY = "smoke-test-secret-key-123";
const SHELL_OVERRIDES = [
  "NEBIUS_API_KEY",
  "NEBIUS_BASE_URL",
  "NEBIUS_MODEL_NANO",
  "NEBIUS_MODEL_SUPER",
  "NEBIUS_MODEL_ULTRA",
  "NEBIUS_SMOKE_MAX_TOKENS",
];
// Blank means unset to the script, so shell values cannot leak into a test.
const BLANK_OVERRIDES = Object.fromEntries(
  SHELL_OVERRIDES.map((name) => [name, ""]),
);

// Synthetic Token Factory replies, keyed by the requested model id.
const toolReply = (name: string, args: string) => ({
  choices: [
    {
      finish_reason: "tool_calls",
      message: { tool_calls: [{ function: { name, arguments: args } }] },
    },
  ],
  usage: { prompt_tokens: 120, completion_tokens: 30 },
});
const GOOD_ARGS = JSON.stringify({
  trailerId: "T-2291",
  dockId: "D-112",
  reason: "D-108 closed",
});
const REPLIES: Record<string, (req: IncomingMessage) => [number, string]> = {
  "mock/good": () => [200, JSON.stringify(toolReply("make_offer", GOOD_ARGS))],
  "mock/unlisted": () => [
    200,
    JSON.stringify(toolReply("make_offer", GOOD_ARGS)),
  ],
  "mock/text": () => [
    200,
    JSON.stringify({
      choices: [
        { finish_reason: "stop", message: { content: "Offer D-112." } },
      ],
    }),
  ],
  "mock/unknown-tool": () => [
    200,
    JSON.stringify(toolReply("book|door", GOOD_ARGS)),
  ],
  "mock/malformed": () => [
    200,
    JSON.stringify(toolReply("make_offer", '{"trailerId":')),
  ],
  "mock/schema": () => [200, JSON.stringify(toolReply("make_offer", "{}"))],
  "mock/truncated": () => [
    200,
    JSON.stringify({
      choices: [{ finish_reason: "length", message: { content: "thinking" } }],
    }),
  ],
  "mock/unauthorized": (req) => [
    401,
    JSON.stringify({ error: "bad token", echo: req.headers.authorization }),
  ],
  "mock/bad-gateway": () => [
    502,
    "<html>\n<h1>502 | Bad Gateway</h1>\n</html>",
  ],
};
const LISTED = Object.keys(REPLIES).filter((id) => id !== "mock/unlisted");

const readBody = async (req: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
};

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createServer(async (req, res) => {
    if (req.url === "/v1/models") {
      res.end(JSON.stringify({ data: LISTED.map((id) => ({ id })) }));
      return;
    }
    const { model } = JSON.parse(await readBody(req)) as { model: string };
    const [status, body] = REPLIES[model]?.(req) ?? [404, "no such model"];
    res.writeHead(status).end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const runSmoke = (
  env: Record<string, string>,
): Promise<{ status: number | null; stdout: string; output: string }> => {
  const child = spawn(process.execPath, [SCRIPT], {
    env: { ...process.env, ...BLANK_OVERRIDES, ...env },
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk: Buffer) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk;
  });
  return new Promise((resolve) => {
    child.on("close", (status) =>
      resolve({ status, stdout, output: stdout + stderr }),
    );
  });
};

const runTiers = (nano: string, superModel: string, ultra: string) =>
  runSmoke({
    NEBIUS_API_KEY: KEY,
    NEBIUS_BASE_URL: baseUrl,
    NEBIUS_MODEL_NANO: nano,
    NEBIUS_MODEL_SUPER: superModel,
    NEBIUS_MODEL_ULTRA: ultra,
  });

const rowFor = (stdout: string, tier: string): string[] => {
  const line = stdout.split("\n").find((l) => l.startsWith(`${tier}: `));
  expect(line, `row for ${tier}`).toBeDefined();
  return (line ?? "").split(" | ");
};

describe("Token Factory smoke script", () => {
  it("exits with a clear message when NEBIUS_API_KEY is missing", async () => {
    const { status, output } = await runSmoke({});

    expect(status).toBe(1);
    expect(output).toContain("NEBIUS_API_KEY is not set");
  });

  it("exits 0 when every tier makes a valid offer, flagging an unlisted model", async () => {
    const { status, stdout, output } = await runTiers(
      "mock/good",
      "mock/good",
      "mock/unlisted",
    );

    expect(status).toBe(0);
    expect(rowFor(stdout, "nano").slice(1, 3)).toEqual(["yes", "yes"]);
    expect(rowFor(stdout, "ultra").slice(1, 3)).toEqual(["no", "yes"]);
    expect(rowFor(stdout, "ultra")[4]).toBe("120 in / 30 out");
    expect(output).not.toContain("Tier");
  });

  it("reports text-only, unknown-tool, malformed and schema-failing calls as no", async () => {
    const first = await runTiers("mock/text", "mock/good", "mock/unknown-tool");
    const second = await runTiers("mock/malformed", "mock/good", "mock/schema");

    expect(first.status).toBe(1);
    expect(rowFor(first.stdout, "nano")[2]).toBe("no (text only)");
    expect(rowFor(first.stdout, "ultra")[2]).toBe(
      "no (unknown tool book\\|door)",
    );
    expect(rowFor(second.stdout, "nano")[2]).toBe("no (malformed arguments)");
    expect(rowFor(second.stdout, "ultra")[2]).toBe(
      "no (arguments fail schema: trailerId, dockId, reason)",
    );
    expect(first.output).toContain(
      "Tier nano failed the tool call. Reroute it with NEBIUS_MODEL_NANO=mock/good",
    );
  });

  it("separates truncation and request errors from tool-call failures", async () => {
    const { status, stdout, output } = await runTiers(
      "mock/truncated",
      "mock/unauthorized",
      "mock/bad-gateway",
    );

    expect(status).toBe(1);
    expect(rowFor(stdout, "nano")[2]).toBe(
      "truncated (finish_reason length at 4096 tokens)",
    );
    expect(rowFor(stdout, "super")[2]).toMatch(
      /^error \(HTTP 401 .*\[redacted\]/,
    );
    expect(rowFor(stdout, "ultra")[2]).toBe(
      "error (HTTP 502 <html> <h1>502 \\| Bad Gateway</h1> </html>)",
    );
    expect(stdout.trim().split("\n")).toHaveLength(5);
    expect(output).toContain("Tier nano hit the token cap.");
    expect(output).toContain("Tier super request failed.");
    expect(output).not.toContain("Reroute");
    expect(output).not.toContain(KEY);
  });

  it("never prints the key and names the cause when the network fails", async () => {
    const closed = createServer();
    await new Promise<void>((resolve) =>
      closed.listen(0, "127.0.0.1", resolve),
    );
    const { port } = closed.address() as AddressInfo;
    await new Promise((resolve) => closed.close(resolve));

    const { status, output } = await runSmoke({
      NEBIUS_API_KEY: KEY,
      NEBIUS_BASE_URL: `http://127.0.0.1:${port}/v1`,
    });

    expect(status).toBe(1);
    expect(output).toContain("nvidia/nemotron-3-super-120b-a12b");
    expect(output).toContain("ECONNREFUSED");
    expect(output).not.toContain("Reroute");
    expect(output).not.toContain(KEY);
  });
});
