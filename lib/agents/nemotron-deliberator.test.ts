import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TurnInput } from "../../types/run";
import { BaselineDeliberator } from "../run/baseline-deliberator";
import { tierFor } from "../run/registry";
import { Run } from "../run/run";
import {
  createNemotronDeliberator,
  FALLBACK_MODEL,
  NEMOTRON_TIMEOUT_MS,
} from "./nemotron-deliberator";
import type { AgentState } from "./types";

// Synthetic test fixture: IDs follow the D-108 scenario, values are made up.
const DRIVER: AgentState = {
  id: "DRV-047",
  role: "driver",
  name: "Driver DRV-047",
  assignedEntityId: "T-2291",
  goals: [],
  obligations: [],
  inbox: [],
  outbox: [],
  memory: [],
  fallbackCounter: 0,
};

const OFFER = {
  id: "M-1",
  fromAgentId: "DOCK-C",
  toAgentId: "DRV-047",
  purpose: "offer" as const,
  payload: { commitmentId: "C-1", task: "Relocate T-2291 to D-112" },
  sentAt: 100,
};

const input = (overrides: Partial<TurnInput> = {}): TurnInput => ({
  agent: { ...DRIVER, inbox: [OFFER] },
  tier: "nano",
  observation: { time: 100, version: 7, role: "driver", trailerId: "T-2291" },
  inbox: [OFFER],
  stateVersion: 7,
  logicalTime: 100,
  ...overrides,
});

const ACCEPT_ARGS = {
  participantId: "DRV-047",
  commitmentId: "C-1",
  acceptedAtVersion: 7,
};

const NANO_MODEL = "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B";
const TEST_KEY = "nebius-test-key-123";

const completion = (message: Record<string, unknown>, finishReason: string) =>
  Response.json({
    choices: [{ index: 0, message, finish_reason: finishReason }],
    usage: { prompt_tokens: 812, completion_tokens: 96, total_tokens: 908 },
  });

const toolReply = (name: string, args: unknown) =>
  completion(
    {
      role: "assistant",
      content: "D-112 fits my window; accepting.",
      tool_calls: [
        {
          id: "call-1",
          type: "function",
          function: {
            name,
            arguments: typeof args === "string" ? args : JSON.stringify(args),
          },
        },
      ],
    },
    "tool_calls",
  );

const toolReplyRaw = (fn: Record<string, unknown>) =>
  completion(
    { role: "assistant", content: null, tool_calls: [{ function: fn }] },
    "tool_calls",
  );

type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

const stubFetch = (response: Response | (() => Promise<Response>)) => {
  const fetchMock = vi.fn<FetchFn>(
    typeof response === "function" ? response : () => Promise.resolve(response),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

describe("createNemotronDeliberator", () => {
  beforeEach(() => {
    vi.stubEnv("NEBIUS_API_KEY", TEST_KEY);
    vi.stubEnv("NEBIUS_BASE_URL", "");
    vi.stubEnv("NEBIUS_MODEL_NANO", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("has kind nemotron", () => {
    expect(createNemotronDeliberator().kind).toBe("nemotron");
  });

  it("captures usage tokens and the requested model id", async () => {
    const fetchMock = stubFetch(toolReply("accept", ACCEPT_ARGS));

    const decision = await createNemotronDeliberator().decide(input());

    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://api.tokenfactory.us-central1.nebius.com/v1/chat/completions",
    );
    const body = JSON.parse(String(request.body));
    expect(body.model).toBe(NANO_MODEL);
    expect(body.tool_choice).toBe("required");
    expect(
      body.tools.map((t: { function: { name: string } }) => t.function.name),
    ).toEqual(expect.arrayContaining(["accept", "propose", "wait"]));
    expect((request.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TEST_KEY}`,
    );

    expect(decision.toolCall).toEqual({
      tool: "accept",
      parameters: ACCEPT_ARGS,
    });
    expect(decision.thought).toBe("D-112 fits my window; accepting.");
    expect(decision.call).toMatchObject({
      agentId: "DRV-047",
      role: "driver",
      tier: "nano",
      model: NANO_MODEL,
      isFallback: false,
      promptTokens: 812,
      completionTokens: 96,
      logicalTime: 100,
      stateVersion: 7,
    });
    expect(decision.call.fallbackReason).toBeUndefined();
    expect(decision.call.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("uses the tier's env override as the requested model", async () => {
    vi.stubEnv("NEBIUS_MODEL_NANO", "nvidia/override-model");
    const fetchMock = stubFetch(toolReply("accept", ACCEPT_ARGS));

    const decision = await createNemotronDeliberator().decide(input());

    const request = fetchMock.mock.calls[0][1];
    expect(JSON.parse(String(request.body)).model).toBe(
      "nvidia/override-model",
    );
    expect(decision.call.model).toBe("nvidia/override-model");
  });

  it("records unreported usage as null, never 0", async () => {
    stubFetch(
      Response.json({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  type: "function",
                  function: {
                    name: "accept",
                    arguments: JSON.stringify(ACCEPT_ARGS),
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      }),
    );

    const decision = await createNemotronDeliberator().decide(input());

    expect(decision.call.isFallback).toBe(false);
    expect(decision.call.promptTokens).toBeNull();
    expect(decision.call.completionTokens).toBeNull();
  });

  it("treats a wait call as a Nemotron decision with no tool call", async () => {
    stubFetch(toolReply("wait", { reason: "No offer needs an answer yet." }));

    const decision = await createNemotronDeliberator().decide(input());

    expect(decision.toolCall).toBeUndefined();
    expect(decision.call.isFallback).toBe(false);
    expect(decision.call.model).toBe(NANO_MODEL);
    expect(decision.thought).toBe("No offer needs an answer yet.");
  });

  it('text-only reply → isFallback true, fallbackReason "malformed_tool_call", no toolCall', async () => {
    stubFetch(
      completion({ role: "assistant", content: "I accept offer C-1." }, "stop"),
    );

    const decision = await createNemotronDeliberator().decide(input());

    expect(decision.toolCall).toBeUndefined();
    expect(decision.call.isFallback).toBe(true);
    expect(decision.call.fallbackReason).toBe("malformed_tool_call");
    // The Nemotron model that failed, so its tokens are attributed to it.
    expect(decision.call.model).toBe(NANO_MODEL);
    expect(decision.thought).not.toContain("I accept offer C-1.");
    // Nemotron still spent tokens; the budget must see them.
    expect(decision.call.promptTokens).toBe(812);
    expect(decision.call.completionTokens).toBe(96);
  });

  it("reasoning-only reply cut off at the token cap → malformed_tool_call", async () => {
    stubFetch(
      Response.json({
        choices: [
          {
            message: {
              content: null,
              reasoning_content: "The dock is closed, so I should...",
            },
            finish_reason: "length",
          },
        ],
        usage: { prompt_tokens: 812, completion_tokens: 4096 },
      }),
    );

    const decision = await createNemotronDeliberator().decide(input());

    expect(decision.toolCall).toBeUndefined();
    expect(decision.call.isFallback).toBe(true);
    expect(decision.call.fallbackReason).toBe("malformed_tool_call");
    expect(decision.call.completionTokens).toBe(4096);
  });

  it.each([
    [
      "arguments failing AgentToolCallSchema",
      "accept",
      { commitmentId: "C-1" },
    ],
    ["arguments that are not JSON", "accept", "{participantId: DRV-047"],
    ["an unknown tool", "teleport", { trailerId: "T-2291" }],
    [
      "a tool agents may not call",
      "injectDisruption",
      {
        disruptionId: "H-9",
        type: "dock_closure",
        targetId: "D-112",
      },
    ],
  ])("%s → same as a text-only reply", async (_label, name, args) => {
    stubFetch(toolReply(name, args));

    const decision = await createNemotronDeliberator().decide(input());

    expect(decision.toolCall).toBeUndefined();
    expect(decision.call.isFallback).toBe(true);
    expect(decision.call.fallbackReason).toBe("malformed_tool_call");
    expect(decision.call.model).toBe(NANO_MODEL);
  });

  it.each([
    ["completion_tokens null", { prompt_tokens: 900, completion_tokens: null }],
    ["completion_tokens missing", { prompt_tokens: 900 }],
    ["a fractional count", { prompt_tokens: 900, completion_tokens: 1.5 }],
  ])("usage with %s keeps the reply and the known count", async (_label, usage) => {
    stubFetch(
      Response.json({
        choices: [
          {
            message: {
              tool_calls: [
                {
                  function: {
                    name: "accept",
                    arguments: JSON.stringify(ACCEPT_ARGS),
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
        usage,
      }),
    );

    const decision = await createNemotronDeliberator().decide(input());

    expect(decision.call.isFallback).toBe(false);
    expect(decision.toolCall?.tool).toBe("accept");
    expect(decision.call.promptTokens).toBe(900);
    expect(decision.call.completionTokens).toBeNull();
  });

  it("accepts tool arguments sent as an object", async () => {
    stubFetch(toolReplyRaw({ name: "accept", arguments: ACCEPT_ARGS }));

    const decision = await createNemotronDeliberator().decide(input());

    expect(decision.call.isFallback).toBe(false);
    expect(decision.toolCall).toEqual({
      tool: "accept",
      parameters: ACCEPT_ARGS,
    });
  });

  it.each([
    ["null arguments", { name: "wait", arguments: null }],
    ["a tool call without a function name", { arguments: "{}" }],
    ["arguments that are a number", { name: "wait", arguments: 7 }],
  ])("%s → malformed_tool_call, keeping usage", async (_label, fn) => {
    stubFetch(toolReplyRaw(fn));

    const decision = await createNemotronDeliberator().decide(input());

    expect(decision.toolCall).toBeUndefined();
    expect(decision.call.isFallback).toBe(true);
    expect(decision.call.fallbackReason).toBe("malformed_tool_call");
    expect(decision.call.model).toBe(NANO_MODEL);
    expect(decision.call.promptTokens).toBe(812);
    expect(decision.call.completionTokens).toBe(96);
  });

  it("a reply without a readable message → malformed_tool_call, keeping usage", async () => {
    stubFetch(
      Response.json({
        choices: [{ message: "not an object" }],
        usage: { prompt_tokens: 812, completion_tokens: 96 },
      }),
    );

    const decision = await createNemotronDeliberator().decide(input());

    expect(decision.call.fallbackReason).toBe("malformed_tool_call");
    expect(decision.call.promptTokens).toBe(812);
  });

  it('HTTP 429 → fallbackReason "http_error" with a labeled fallback decision', async () => {
    stubFetch(new Response("Rate limited", { status: 429 }));

    const decision = await createNemotronDeliberator().decide(input());

    expect(decision.call.isFallback).toBe(true);
    expect(decision.call.fallbackReason).toBe("http_error");
    expect(decision.call.model).toBe(FALLBACK_MODEL);
    expect(decision.call.promptTokens).toBeNull();
    expect(decision.thought).toMatch(/^Fallback \(http_error\)/);
    // The deterministic fallback body answers the pending offer.
    expect(decision.toolCall?.tool).toBe("accept");
    expect(decision.toolCall?.parameters.commitmentId).toBe("C-1");
  });

  it("a network failure → http_error", async () => {
    stubFetch(() => Promise.reject(new TypeError("fetch failed")));

    const decision = await createNemotronDeliberator().decide(input());

    expect(decision.call.fallbackReason).toBe("http_error");
    expect(decision.call.isFallback).toBe(true);
  });

  it('timeout after 20 s → fallbackReason "timeout"', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason),
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    let settled = false;
    const pending = createNemotronDeliberator()
      .decide(input())
      .finally(() => {
        settled = true;
      });
    await vi.advanceTimersByTimeAsync(NEMOTRON_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const decision = await pending;

    expect(NEMOTRON_TIMEOUT_MS).toBe(20_000);
    expect(decision.call.isFallback).toBe(true);
    expect(decision.call.fallbackReason).toBe("timeout");
    expect(decision.call.latencyMs).toBeGreaterThanOrEqual(NEMOTRON_TIMEOUT_MS);
  });

  it('missing NEBIUS_API_KEY → fallbackReason "no_api_key" without calling the network', async () => {
    vi.stubEnv("NEBIUS_API_KEY", "");
    vi.stubEnv("NVIDIA_API_KEY", "unrelated-provider-key");
    const fetchMock = stubFetch(toolReply("accept", ACCEPT_ARGS));

    const decision = await createNemotronDeliberator().decide(input());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(decision.call.isFallback).toBe(true);
    expect(decision.call.fallbackReason).toBe("no_api_key");
    expect(decision.call.model).toBe(FALLBACK_MODEL);
    expect(decision.call.promptTokens).toBeNull();
    expect(decision.thought).toMatch(/^Fallback \(no_api_key\)/);
  });

  it("never puts the key in logs or thoughts, even when the provider echoes it", async () => {
    stubFetch(new Response(`invalid key ${TEST_KEY}`, { status: 401 }));

    const decision = await createNemotronDeliberator().decide(input());

    expect(decision.call.fallbackReason).toBe("http_error");
    expect(decision.thought).not.toContain(TEST_KEY);
    const warn = vi.mocked(console.warn);
    expect(warn).toHaveBeenCalled();
    for (const args of warn.mock.calls) {
      expect(args.map(String).join(" ")).not.toContain(TEST_KEY);
    }
  });

  it("sends the scoped observation and the new inbox, not a guessed state", async () => {
    const fetchMock = stubFetch(toolReply("accept", ACCEPT_ARGS));

    await createNemotronDeliberator().decide(input());

    const request = fetchMock.mock.calls[0][1];
    const { messages } = JSON.parse(String(request.body));
    const text = messages.map((m: { content: string }) => m.content).join("\n");
    expect(messages[0].role).toBe("system");
    expect(text).toContain("autonomous Freight Driver Agent");
    expect(text).toContain("DRV-047");
    expect(text).toContain("C-1");
    expect(text).toContain("state version: 7");
  });

  it("tells the dock lead its counterparts and the scenario's unload facts", async () => {
    const fetchMock = stubFetch(toolReply("wait", { reason: "Waiting." }));
    const dockLead: AgentState = {
      ...DRIVER,
      id: "DOCK-C",
      role: "dock_lead",
      name: "Dock Lead C",
      assignedEntityId: "D-108",
    };

    await createNemotronDeliberator().decide(
      input({ agent: dockLead, tier: "super", inbox: [] }),
    );

    const { messages } = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    const user: string = messages[1].content;
    expect(user).toContain("COUNTERPARTS:");
    expect(user).toContain("- DRV-047: driver, assigned T-2291");
    expect(user).toContain("- YARD-1: yard_controller, assigned YT-2");
    expect(user).not.toContain("- DOCK-C:");
    expect(user).toContain('"provenance":"scenario"');
    expect(user).toContain('"shipmentId":"SH-5512"');
    expect(user).toContain('"relocationTargetDocks":["D-112"]');
  });

  it("repeats an unanswered offer on later turns, after it left the new-message inbox", async () => {
    const fetchMock = stubFetch(toolReply("wait", { reason: "Waiting." }));

    await createNemotronDeliberator().decide(input({ inbox: [] }));

    const { messages } = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    const user: string = messages[1].content;
    const pending = user.split("OFFERS TO YOU NOT YET ANSWERED:\n")[1];
    expect(pending.split("\n")[0]).toContain('"commitmentId":"C-1"');
    expect(user).toContain("NEW MESSAGES SINCE YOUR LAST TURN:\n[]");
  });

  it("with no key, a live D-108 run relocates T-2291 to D-112 on labeled fallbacks", async () => {
    vi.stubEnv("NEBIUS_API_KEY", "");
    const fetchMock = stubFetch(toolReply("wait", { reason: "unused" }));
    const run = new Run({
      runId: "no-key",
      mode: "live",
      deliberator: createNemotronDeliberator(),
      fallbackDeliberator: new BaselineDeliberator(),
      tierFor,
    });
    run.injectDisruption({ type: "dock_closure", targetId: "D-108" });

    let snapshot = run.snapshot();
    for (let i = 0; i < 10 && snapshot.status !== "done"; i++) {
      snapshot = (await run.step(4)).snapshot;
    }

    expect(fetchMock).not.toHaveBeenCalled();
    expect(snapshot.status).toBe("done");
    const trailer = snapshot.engine.state.trailers.find(
      ([id]) => id === "T-2291",
    )?.[1];
    expect(trailer?.location).toEqual({ kind: "dock", dockId: "D-112" });
    expect(snapshot.modelCalls.length).toBeGreaterThan(0);
    for (const call of snapshot.modelCalls) {
      expect(call).toMatchObject({
        isFallback: true,
        fallbackReason: "no_api_key",
        model: FALLBACK_MODEL,
      });
      expect(call.outcome).not.toBe("rejected");
    }
    expect(
      snapshot.events
        .filter((e) => e.kind === "model_call")
        .map((e) => e.provenance),
    ).not.toContain("nemotron");
  });
});
