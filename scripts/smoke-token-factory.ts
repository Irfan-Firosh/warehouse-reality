/**
 * Token Factory smoke test (plan Task B1): lists the models, then sends one
 * chat completion per tier with a single `make_offer` tool.
 * Run: node --env-file-if-exists=.env.local scripts/smoke-token-factory.ts
 * The API key is read from NEBIUS_API_KEY and never printed.
 * NEBIUS_SMOKE_MAX_TOKENS raises the completion cap for reasoning models.
 */

import { z } from "zod";
import {
  MODEL_ENV_BY_TIER,
  MODEL_TIERS,
  modelFor,
  NEBIUS_DEFAULT_BASE_URL,
} from "../lib/agents/models.ts";

const REQUEST_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_COMPLETION_TOKENS = 4096;
const ERROR_BODY_CHARS = 200;

const blankToUndefined = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const Env = z.object({
  NEBIUS_API_KEY: blankToUndefined,
  NEBIUS_BASE_URL: blankToUndefined.pipe(z.url().optional()),
  NEBIUS_SMOKE_MAX_TOKENS: blankToUndefined.pipe(
    z.coerce.number<string>().int().positive().optional(),
  ),
});

const ModelList = z.object({ data: z.array(z.object({ id: z.string() })) });

const Choice = z.object({
  finish_reason: z.string().nullish(),
  message: z.object({
    tool_calls: z
      .array(
        z.object({
          function: z.object({ name: z.string(), arguments: z.string() }),
        }),
      )
      .nullish(),
  }),
});

const Completion = z.object({
  choices: z.array(Choice).min(1),
  usage: z
    .object({ prompt_tokens: z.number(), completion_tokens: z.number() })
    .nullish(),
});

const MakeOfferArgs = z.object({
  trailerId: z.string().min(1),
  dockId: z.string().min(1),
  reason: z.string().min(1),
});

const MAKE_OFFER_TOOL = {
  type: "function",
  function: {
    name: "make_offer",
    description: "Offer a trailer a replacement dock door for a time window.",
    parameters: {
      type: "object",
      properties: {
        trailerId: { type: "string" },
        dockId: { type: "string" },
        reason: { type: "string" },
      },
      required: ["trailerId", "dockId", "reason"],
    },
  },
} as const;

const MESSAGES = [
  {
    role: "system",
    content:
      "You are a warehouse dock lead. Act only by calling the make_offer tool.",
  },
  {
    role: "user",
    content:
      "Door D-108 just closed. Trailer T-2291 was assigned to it and door D-112 is free. Make the offer.",
  },
] as const;

// pass: a valid make_offer call. fail: the model answered without one.
// truncated: the reply hit max_tokens. error: the request itself failed.
type Verdict = "pass" | "fail" | "truncated" | "error";

interface Judgement {
  verdict: Verdict;
  detail: string;
}

interface Probe extends Judgement {
  latencyMs: string;
  usage: string;
}

interface Client {
  baseUrl: string;
  headers: Record<string, string>;
  maxTokens: number;
}

const judged = (verdict: Verdict, detail = ""): Judgement => ({
  verdict,
  detail,
});

const issuePaths = (error: z.ZodError): string =>
  error.issues.map((issue) => issue.path.join(".") || "(root)").join(", ");

const errorText = (err: unknown): string => {
  if (!(err instanceof Error)) return String(err);
  const { cause } = err;
  const code =
    typeof cause === "object" && cause !== null && "code" in cause
      ? `${String(cause.code)} `
      : "";
  const causeText =
    cause instanceof Error ? ` (cause: ${code}${cause.message})` : "";
  return `${err.name}: ${err.message}${causeText}`;
};

const httpError = async (response: Response): Promise<string> => {
  const body = (await response.text()).slice(0, ERROR_BODY_CHARS);
  return `HTTP ${response.status} ${body}`;
};

const listModels = async (
  client: Client,
): Promise<{ ids: Set<string> } | { error: string }> => {
  try {
    const response = await fetch(`${client.baseUrl}/models`, {
      headers: client.headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return { error: await httpError(response) };
    const list = ModelList.safeParse(await response.json());
    if (!list.success) {
      return { error: `unexpected response: ${issuePaths(list.error)}` };
    }
    return { ids: new Set(list.data.data.map((m) => m.id)) };
  } catch (err) {
    return { error: errorText(err) };
  }
};

const judgeChoice = (
  choice: z.infer<typeof Choice>,
  maxTokens: number,
): Judgement => {
  if (choice.finish_reason === "length") {
    return judged("truncated", `finish_reason length at ${maxTokens} tokens`);
  }
  const call = choice.message.tool_calls?.[0];
  if (!call) return judged("fail", "text only");
  if (call.function.name !== MAKE_OFFER_TOOL.function.name) {
    return judged("fail", `unknown tool ${call.function.name}`);
  }
  let args: unknown;
  try {
    args = JSON.parse(call.function.arguments);
  } catch {
    return judged("fail", "malformed arguments");
  }
  const offer = MakeOfferArgs.safeParse(args);
  return offer.success
    ? judged("pass")
    : judged("fail", `arguments fail schema: ${issuePaths(offer.error)}`);
};

const probeModel = async (client: Client, model: string): Promise<Probe> => {
  const started = Date.now();
  const finish = (judgement: Judgement, usage = "-"): Probe => ({
    ...judgement,
    latencyMs: String(Date.now() - started),
    usage,
  });
  try {
    const response = await fetch(`${client.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { ...client.headers, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        model,
        messages: MESSAGES,
        tools: [MAKE_OFFER_TOOL],
        tool_choice: "auto",
        temperature: 0,
        max_tokens: client.maxTokens,
      }),
    });
    if (!response.ok) return finish(judged("error", await httpError(response)));
    const completion = Completion.safeParse(await response.json());
    if (!completion.success) {
      const shape = issuePaths(completion.error);
      return finish(judged("error", `unexpected response: ${shape}`));
    }
    const { choices, usage } = completion.data;
    return finish(
      judgeChoice(choices[0], client.maxTokens),
      usage
        ? `${usage.prompt_tokens} in / ${usage.completion_tokens} out`
        : "not reported",
    );
  } catch (err) {
    return finish(judged("error", errorText(err)));
  }
};

const toolCallCell = ({ verdict, detail }: Judgement): string => {
  if (verdict === "pass") return "yes";
  const label = verdict === "fail" ? "no" : verdict;
  return `${label} (${detail})`;
};

type Tier = (typeof MODEL_TIERS)[number];

const hintFor = (tier: Tier, model: string, verdict: Verdict): string => {
  if (verdict === "error") {
    return `Tier ${tier} request failed. Retry, or check NEBIUS_API_KEY and access to ${model}.`;
  }
  if (verdict === "truncated") {
    return `Tier ${tier} hit the token cap. Raise NEBIUS_SMOKE_MAX_TOKENS and rerun.`;
  }
  const reroute =
    tier === "super"
      ? "Super is the reroute target, so check model access first."
      : `Reroute it with ${MODEL_ENV_BY_TIER[tier]}=${modelFor("super")}`;
  return `Tier ${tier} failed the tool call. ${reroute}`;
};

const main = async (): Promise<number> => {
  const env = Env.safeParse(process.env);
  if (!env.success) {
    console.error(`Invalid environment: ${issuePaths(env.error)}`);
    return 1;
  }
  const apiKey = env.data.NEBIUS_API_KEY;
  if (!apiKey) {
    console.error(
      "NEBIUS_API_KEY is not set. Add it to .env.local and run:\n" +
        "  node --env-file-if-exists=.env.local scripts/smoke-token-factory.ts",
    );
    return 1;
  }
  // One table row per line: the key never prints, and newlines or pipes in
  // upstream bodies cannot split a cell.
  const cell = (text: string): string =>
    text.replaceAll(apiKey, "[redacted]").replace(/\s+/g, " ").trim();
  const tableCell = (text: string): string => cell(text).replaceAll("|", "\\|");

  const client: Client = {
    baseUrl: (env.data.NEBIUS_BASE_URL ?? NEBIUS_DEFAULT_BASE_URL).replace(
      /\/+$/,
      "",
    ),
    headers: { Authorization: `Bearer ${apiKey}` },
    maxTokens:
      env.data.NEBIUS_SMOKE_MAX_TOKENS ?? DEFAULT_MAX_COMPLETION_TOKENS,
  };
  console.log(`Base URL: ${client.baseUrl}`);

  const listed = await listModels(client);
  if ("error" in listed)
    console.error(`GET /models failed: ${cell(listed.error)}`);

  console.log("model | listed? | tool_call? | latencyMs | usage");
  const hints: string[] = [];
  for (const tier of MODEL_TIERS) {
    const model = modelFor(tier);
    const probe = await probeModel(client, model);
    const isListed =
      "ids" in listed ? (listed.ids.has(model) ? "yes" : "no") : "unknown";
    const row = [
      `${tier}: ${model}`,
      isListed,
      toolCallCell(probe),
      probe.latencyMs,
      probe.usage,
    ];
    console.log(row.map(tableCell).join(" | "));
    if (probe.verdict !== "pass")
      hints.push(hintFor(tier, model, probe.verdict));
  }
  for (const hint of hints) console.error(cell(hint));
  return hints.length === 0 ? 0 : 1;
};

process.exitCode = await main();
