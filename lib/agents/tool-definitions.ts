/**
 * OpenAI-compatible function tools for agent turns, generated from the Zod
 * schemas in `schemas.ts`, and the parser that turns a model's tool call back
 * into a validated AgentToolCall. Agents never see `injectDisruption` (only the
 * operator injects disruptions) or `observe` (the observation is in the prompt).
 */

import { type ZodType, z } from "zod";
import {
  AcceptToolSchema,
  AgentToolCallSchema,
  CancelToolSchema,
  CommitToolSchema,
  EscalateToolSchema,
  ExecuteMoveToolSchema,
  ExecuteUnloadToolSchema,
  ProposeToolSchema,
} from "./schemas";
import type { AgentToolCall } from "./types";

export const WAIT_TOOL = "wait";

const WaitToolSchema = z.object({ reason: z.string().trim().min(1) });

type AgentToolName = AgentToolCall["tool"];

const AGENT_TOOLS: ReadonlyArray<{
  name: AgentToolName | typeof WAIT_TOOL;
  description: string;
  schema: ZodType;
}> = [
  {
    name: "propose",
    description:
      "Propose a commitment that reserves resources for a time window. Capacity is locked only when every participant accepts and it is committed.",
    schema: ProposeToolSchema,
  },
  {
    name: "accept",
    description:
      "Accept a commitment you participate in, at the current state version.",
    schema: AcceptToolSchema,
  },
  {
    name: "commit",
    description:
      "Commit a commitment once every participant has accepted. requestId makes the commit idempotent.",
    schema: CommitToolSchema,
  },
  {
    name: "cancel",
    description: "Cancel a commitment you participate in, with a reason.",
    schema: CancelToolSchema,
  },
  {
    name: "executeMove",
    description: "Move a trailer to a location under a committed commitment.",
    schema: ExecuteMoveToolSchema,
  },
  {
    name: "executeUnload",
    description: "Unload cargo from a trailer at its dock.",
    schema: ExecuteUnloadToolSchema,
  },
  {
    name: "escalate",
    description:
      "Escalate an unresolved conflict to the supervisor, listing the choices left open.",
    schema: EscalateToolSchema,
  },
  {
    name: WAIT_TOOL,
    description: "Take no action this turn, with a short reason.",
    schema: WaitToolSchema,
  },
];

export interface ChatTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// Input-side JSON Schema: fields with a Zod default stay optional for the model.
const parametersOf = (schema: ZodType): Record<string, unknown> => {
  const { $schema: _dialect, ...parameters } = z.toJSONSchema(schema, {
    io: "input",
  });
  return parameters;
};

export const AGENT_CHAT_TOOLS: readonly ChatTool[] = AGENT_TOOLS.map(
  ({ name, description, schema }) => ({
    type: "function",
    function: { name, description, parameters: parametersOf(schema) },
  }),
);

export type ParsedToolCall =
  | { kind: "tool"; toolCall: AgentToolCall }
  | { kind: "wait"; reason: string }
  | { kind: "invalid"; detail: string };

const offered = new Set<string>(AGENT_TOOLS.map((t) => t.name));

/** Validate a model's `function.name` and JSON-string `function.arguments`. */
export const parseToolCall = (
  name: string,
  rawArguments: string,
): ParsedToolCall => {
  if (!offered.has(name)) {
    return { kind: "invalid", detail: `unknown tool ${name}` };
  }
  let parameters: unknown;
  try {
    parameters = JSON.parse(rawArguments);
  } catch {
    return { kind: "invalid", detail: `${name} arguments are not JSON` };
  }
  if (name === WAIT_TOOL) {
    const wait = WaitToolSchema.safeParse(parameters);
    return wait.success
      ? { kind: "wait", reason: wait.data.reason }
      : { kind: "invalid", detail: "wait arguments fail the schema" };
  }
  const call = AgentToolCallSchema.safeParse({ tool: name, parameters });
  return call.success
    ? { kind: "tool", toolCall: call.data }
    : { kind: "invalid", detail: `${name} arguments fail the schema` };
};
