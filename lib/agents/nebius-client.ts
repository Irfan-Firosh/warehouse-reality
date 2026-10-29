/**
 * Nebius / NVIDIA API Client with Offline Deterministic Fallback (PRD §1, §6).
 * Handles model inference via OpenAI-compatible endpoints with strict error boundaries.
 */

import { z } from "zod";
import type { FallbackReason } from "../../types/run";
import type { ChatTool } from "./tool-definitions";
import type { AgentRole, AgentToolCall } from "./types";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface NebiusDeliberationResponse {
  thought: string;
  toolCall?: AgentToolCall;
  isMock: boolean;
  modelUsed: string;
  latencyMs: number;
}

/** Characters of an upstream error body kept for logs. */
const ERROR_DETAIL_CHARS = 200;

const describeError = (err: unknown): string =>
  err instanceof Error ? `${err.name}: ${err.message}` : String(err);

/** Upstream error text made safe to log: key redacted, length capped. */
const redactDetail = (detail: string, apiKey: string): string =>
  detail.replaceAll(apiKey, "[redacted]").slice(0, ERROR_DETAIL_CHARS);

/**
 * Deterministic local fallback deliberation when NEBIUS_API_KEY is not configured
 * or network is offline during hackathon review / testing.
 */
export const fallbackLocalDeliberation = (
  role: AgentRole,
  agentId: string,
  observation: Record<string, unknown>,
  inbox: Array<Record<string, unknown>>,
  version: number,
): { thought: string; toolCall?: AgentToolCall } => {
  const time = typeof observation.time === "number" ? observation.time : 50850;

  if (role === "driver") {
    // Check if there is an unhandled offer in the inbox
    const offerMsg = inbox.find(
      (m) =>
        m.purpose === "offer" ||
        (m.payload &&
          typeof m.payload === "object" &&
          "commitmentId" in m.payload),
    );

    if (offerMsg?.payload) {
      const commitmentId =
        (offerMsg.payload as { commitmentId?: string }).commitmentId ?? "C-88";
      return {
        thought: `Received dock relocation offer ${commitmentId} for my trailer. Dock D-108 is closed; alternative door window satisfies ETA target 15:30. Accepting offer.`,
        toolCall: {
          tool: "accept",
          parameters: {
            participantId: agentId,
            commitmentId,
            acceptedAtVersion: version,
          },
        },
      };
    }

    return {
      thought: `Driver ${agentId} observing trailer ${observation.trailerId ?? "T-2291"}. Waiting for dock readiness or instruction.`,
    };
  }

  if (role === "dock_lead") {
    // Check if D-108 is closed and we need to propose D-112
    const docks = Array.isArray(observation.docks) ? observation.docks : [];
    const closedDock = docks.find(
      (d: { id: string; status: string }) =>
        d.status === "closed" && d.id === "D-108",
    );

    if (closedDock) {
      // Propose relocation to D-112
      return {
        thought:
          "Dock D-108 is closed due to disruption H-1. Door D-112 is free. Formulating atomic commitment proposal to relocate trailer T-2291 to D-112.",
        toolCall: {
          tool: "propose",
          parameters: {
            task: "Relocate trailer T-2291 to D-112 and resume cargo unload",
            requiredResources: [
              {
                resourceId: "D-112",
                type: "dock",
                startWindow: time + 600,
                endWindow: time + 3600,
              },
              {
                resourceId: "T-2291",
                type: "trailer",
                startWindow: time + 600,
                endWindow: time + 3600,
              },
            ],
            expiresAt: time + 900,
            participants: [
              { agentId: "DRV-047", role: "driver", accepted: false },
              {
                agentId: "DOCK-C",
                role: "dock_lead",
                accepted: true,
                acceptedAtVersion: version,
              },
              { agentId: "YARD-1", role: "yard_controller", accepted: false },
            ],
          },
        },
      };
    }

    return {
      thought: `Dock Lead ${agentId} monitoring assigned doors in Sector C. All assigned doors operating within parameters.`,
    };
  }

  if (role === "yard_controller") {
    // If movement task requested, execute move with YT-2
    return {
      thought: `Yard Controller ${agentId} coordinating hostler tractor YT-2 for yard relocation across approved lanes.`,
      toolCall: {
        tool: "executeMove",
        parameters: {
          trailerId: "T-2291",
          targetLocation: { kind: "dock", dockId: "D-112" },
          tractorId: "YT-2",
        },
      },
    };
  }

  if (role === "supervisor") {
    return {
      thought: `Supervisor ${agentId} reviewing shift status. All hard physical invariants and SLAs are currently satisfied.`,
    };
  }

  return {
    thought: `Agent ${agentId} in role ${role} completed observation cycle.`,
  };
};

export const callNebiusModel = async (
  messages: LLMMessage[],
  role: AgentRole,
  agentId: string,
  observation: Record<string, unknown>,
  inbox: Array<Record<string, unknown>>,
  version: number,
): Promise<NebiusDeliberationResponse> => {
  const apiKey = process.env.NEBIUS_API_KEY;
  const baseUrl =
    process.env.NEBIUS_BASE_URL ||
    "https://api.tokenfactory.us-central1.nebius.com/v1";
  const model = process.env.NEBIUS_MODEL || "nvidia/nemotron-3-super-120b-a12b";

  const startTime = Date.now();

  // If no API key configured, use deterministic local fallback
  if (!apiKey) {
    const fallback = fallbackLocalDeliberation(
      role,
      agentId,
      observation,
      inbox,
      version,
    );
    return {
      thought: fallback.thought,
      toolCall: fallback.toolCall,
      isMock: true,
      modelUsed: "deterministic-local-engine",
      latencyMs: Date.now() - startTime,
    };
  }

  try {
    const response = await fetch(
      `${baseUrl.replace(/\/+$/, "")}/chat/completions`,
      {
        method: "POST",
        signal: AbortSignal.timeout(60_000),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.1,
          response_format: { type: "json_object" },
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      console.warn(
        `Nebius API error (${response.status}): ${redactDetail(errText, apiKey)}. Using local fallback.`,
      );
      const fallback = fallbackLocalDeliberation(
        role,
        agentId,
        observation,
        inbox,
        version,
      );
      return {
        thought: fallback.thought,
        toolCall: fallback.toolCall,
        isMock: true,
        modelUsed: `fallback (${response.status})`,
        latencyMs: Date.now() - startTime,
      };
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(rawContent);

    return {
      thought: parsed.thought ?? "Deliberation complete.",
      toolCall: parsed.toolCall,
      isMock: false,
      modelUsed: model,
      latencyMs: Date.now() - startTime,
    };
  } catch (err) {
    console.warn(
      `Nebius client error, utilizing deterministic fallback: ${redactDetail(describeError(err), apiKey)}`,
    );
    const fallback = fallbackLocalDeliberation(
      role,
      agentId,
      observation,
      inbox,
      version,
    );
    return {
      thought: fallback.thought,
      toolCall: fallback.toolCall,
      isMock: true,
      modelUsed: "fallback-on-error",
      latencyMs: Date.now() - startTime,
    };
  }
};

// Token Factory chat completion (docs.tokenfactory.nebius.com, create-chat-completion).
// Read leniently: an odd usage field or tool call never discards the rest of
// the reply. Reasoning models may also return `reasoning_content` or `reasoning`.
const TokenCount = z.number().int().nonnegative().nullable().catch(null);

const CompletionSchema = z.object({
  choices: z.array(z.unknown()).catch([]),
  usage: z
    .object({ prompt_tokens: TokenCount, completion_tokens: TokenCount })
    .nullable()
    .catch(null),
});

const MessageSchema = z.object({
  finish_reason: z.string().nullish(),
  message: z.object({
    content: z.string().nullish(),
    reasoning_content: z.string().nullish(),
    reasoning: z.string().nullish(),
    tool_calls: z.array(z.unknown()).nullish(),
  }),
});

// Some OpenAI-compatible servers send arguments as an object, or null for none.
const ToolCallEntrySchema = z.object({
  function: z.object({
    name: z.string(),
    arguments: z
      .union([z.string(), z.record(z.string(), z.unknown()), z.null()])
      .optional()
      .transform((args) =>
        typeof args === "string" ? args : JSON.stringify(args ?? {}),
      ),
  }),
});

export interface ToolCallRequest {
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: ReadonlyArray<{ role: "system" | "user"; content: string }>;
  tools: readonly ChatTool[];
  timeoutMs: number;
  maxTokens: number;
}

export type ToolCallResponse =
  | {
      ok: true;
      latencyMs: number;
      // null when the provider did not report usage; never guessed.
      promptTokens: number | null;
      completionTokens: number | null;
      finishReason: string | null;
      content: string | null;
      reasoning: string | null;
      /** The first tool call; a turn makes one. */
      toolCall: { name: string; arguments: string } | null;
      /** Why the reply's message or tool call could not be read, if so. */
      unreadable: string | null;
    }
  | {
      ok: false;
      reason: Extract<FallbackReason, "http_error" | "timeout">;
      /** Safe to log: the API key is redacted. */
      detail: string;
      latencyMs: number;
    };

type ChoiceFields = Pick<
  Extract<ToolCallResponse, { ok: true }>,
  "finishReason" | "content" | "reasoning" | "toolCall" | "unreadable"
>;

const UNREADABLE_CHOICE: ChoiceFields = {
  finishReason: null,
  content: null,
  reasoning: null,
  toolCall: null,
  unreadable: "no readable message",
};

const readChoice = (choice: unknown): ChoiceFields => {
  const parsed = MessageSchema.safeParse(choice);
  if (!parsed.success) return UNREADABLE_CHOICE;
  const { message, finish_reason } = parsed.data;
  const first = message.tool_calls?.[0];
  const call =
    first === undefined ? undefined : ToolCallEntrySchema.safeParse(first);
  return {
    finishReason: finish_reason ?? null,
    content: message.content ?? null,
    reasoning: message.reasoning_content ?? message.reasoning ?? null,
    toolCall: call?.success ? call.data.function : null,
    unreadable:
      call && !call.success ? "tool call entry has no readable function" : null,
  };
};

/**
 * One OpenAI-compatible chat completion with tools. Never throws for transport
 * or provider failures: HTTP errors, network errors and unreadable bodies are
 * `http_error`, and no response within `timeoutMs` is `timeout`.
 */
export const requestToolCall = async ({
  apiKey,
  baseUrl,
  model,
  messages,
  tools,
  timeoutMs,
  maxTokens,
}: ToolCallRequest): Promise<ToolCallResponse> => {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const fail = (
    reason: "http_error" | "timeout",
    detail: string,
  ): ToolCallResponse => ({
    ok: false,
    reason,
    detail: redactDetail(detail, apiKey),
    latencyMs: Date.now() - started,
  });

  try {
    const response = await fetch(
      `${baseUrl.replace(/\/+$/, "")}/chat/completions`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          tools,
          // Documented by Token Factory; with the `wait` tool, a turn always has a call.
          tool_choice: "required",
          temperature: 0.1,
          max_tokens: maxTokens,
        }),
      },
    );
    if (!response.ok) {
      return fail(
        "http_error",
        `HTTP ${response.status} ${await response.text()}`,
      );
    }
    const parsed = CompletionSchema.safeParse(await response.json());
    if (!parsed.success) return fail("http_error", "unexpected response shape");
    return {
      ok: true,
      latencyMs: Date.now() - started,
      promptTokens: parsed.data.usage?.prompt_tokens ?? null,
      completionTokens: parsed.data.usage?.completion_tokens ?? null,
      ...readChoice(parsed.data.choices[0]),
    };
  } catch (err) {
    return controller.signal.aborted
      ? fail("timeout", `no response within ${timeoutMs} ms`)
      : fail("http_error", describeError(err));
  } finally {
    clearTimeout(timer);
  }
};
