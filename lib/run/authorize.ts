/**
 * Role authorization for agent tool calls (PRD §8.1, plan Task A4).
 * Pure: checks a call against the permission matrix and the engine snapshot.
 */

import type { ZodType } from "zod";
import {
  AcceptToolSchema,
  CancelToolSchema,
  CommitToolSchema,
  ExecuteMoveToolSchema,
  ExecuteUnloadToolSchema,
  ProposeToolSchema,
} from "../agents/schemas";
import type { AgentState, AgentToolCall } from "../agents/types";
import type {
  CommitmentEntity,
  EngineSnapshot,
  ReasonCode,
} from "../engine/types";

export type AuthorizationResult =
  | { ok: true }
  | {
      ok: false;
      reasonCode: Extract<ReasonCode, "PERMISSION_DENIED">;
      message: string;
    };

type Rule = (
  agent: AgentState,
  parameters: Record<string, unknown>,
  state: EngineSnapshot,
) => string | null; // null = allowed, string = denial message

const OK = null;
const ACTIVE_COMMITMENT: ReadonlySet<CommitmentEntity["status"]> = new Set([
  "committed",
  "executing",
]);

const commitmentsOf = (state: EngineSnapshot): CommitmentEntity[] =>
  state.state.commitments.map(([, c]) => c);

const findCommitment = (state: EngineSnapshot, id: string) =>
  commitmentsOf(state).find((c) => c.id === id);

const isParticipant = (c: CommitmentEntity, agent: AgentState) =>
  c.participants.some((p) => p.agentId === agent.id);

/** Parse parameters with the tool's own Zod schema; deny when malformed. */
const withParams =
  <T>(
    schema: ZodType<T>,
    check: (
      agent: AgentState,
      params: T,
      state: EngineSnapshot,
    ) => string | null,
  ): Rule =>
  (agent, parameters, state) => {
    const parsed = schema.safeParse(parameters);
    if (!parsed.success) return "Malformed tool parameters.";
    return check(agent, parsed.data, state);
  };

const isYardTractor = (state: EngineSnapshot, id: string) =>
  state.state.tractors.some(([, t]) => t.id === id && t.role === "yard") ||
  state.state.equipment.some(
    ([, e]) => e.id === id && e.type === "yard_tractor",
  );

const proposeRule = withParams(ProposeToolSchema, (agent, params, state) => {
  const resources = params.requiredResources;
  switch (agent.role) {
    case "supervisor":
      return OK;
    case "driver":
      return resources.every(
        (r) => r.type === "trailer" && r.resourceId === agent.assignedEntityId,
      )
        ? OK
        : "Drivers may propose only for their own trailer.";
    case "dock_lead":
      return resources.every((r) => r.type === "dock")
        ? OK
        : "Dock leads may propose only docks.";
    case "yard_controller":
      return resources.every(
        (r) =>
          r.type === "stall" ||
          ((r.type === "tractor" || r.type === "equipment") &&
            isYardTractor(state, r.resourceId)),
      )
        ? OK
        : "Yard controllers may propose only stalls and yard tractors.";
  }
});

const acceptRule = withParams(AcceptToolSchema, (agent, params) =>
  params.participantId === agent.id
    ? OK
    : "Agents may accept only as themselves.",
);

const commitRule = withParams(CommitToolSchema, (agent, params, state) => {
  if (agent.role === "supervisor") return OK;
  if (agent.role === "driver") return "Drivers may not commit.";
  const c = findCommitment(state, params.commitmentId);
  return c && isParticipant(c, agent)
    ? OK
    : "Only a participant may commit this commitment.";
});

const executeMoveRule = withParams(
  ExecuteMoveToolSchema,
  (agent, params, state) => {
    if (agent.role !== "yard_controller")
      return "Only yard controllers may execute moves.";
    const tractorId = params.tractorId;
    if (!tractorId || !isYardTractor(state, tractorId))
      return "A move requires a yard tractor.";
    const committed = commitmentsOf(state).some(
      (c) =>
        ACTIVE_COMMITMENT.has(c.status) &&
        isParticipant(c, agent) &&
        c.requiredResources.some((r) => r.resourceId === tractorId),
    );
    return committed
      ? OK
      : "The yard tractor is not under a committed commitment.";
  },
);

const executeUnloadRule = withParams(
  ExecuteUnloadToolSchema,
  (agent, params, state) => {
    if (agent.role !== "dock_lead")
      return "Only dock leads may execute unloads.";
    const trailer = state.state.trailers.find(
      ([, t]) => t.id === params.trailerId,
    )?.[1];
    if (!trailer || trailer.location.kind !== "dock")
      return "The trailer is not at a dock.";
    const { dockId } = trailer.location;
    if (dockId === agent.assignedEntityId) return OK;
    const committedDock = commitmentsOf(state).some(
      (c) =>
        ACTIVE_COMMITMENT.has(c.status) &&
        isParticipant(c, agent) &&
        c.requiredResources.some(
          (r) => r.type === "dock" && r.resourceId === dockId,
        ),
    );
    return committedDock
      ? OK
      : "The trailer is not at one of this dock lead's docks.";
  },
);

const cancelRule = withParams(CancelToolSchema, (agent, params, state) => {
  if (agent.role === "supervisor") return OK;
  const c = findCommitment(state, params.commitmentId);
  return c && isParticipant(c, agent)
    ? OK
    : "Agents may cancel only their own commitments.";
});

const allow: Rule = () => OK;
const deny =
  (message: string): Rule =>
  () =>
    message;

const RULES: Record<AgentToolCall["tool"], Rule> = {
  propose: proposeRule,
  accept: acceptRule,
  commit: commitRule,
  executeMove: executeMoveRule,
  executeUnload: executeUnloadRule,
  cancel: cancelRule,
  escalate: allow,
  observe: allow,
  injectDisruption: deny(
    "No agent may inject a disruption; operator API only.",
  ),
};

export const authorize = (
  agent: AgentState,
  call: AgentToolCall,
  state: EngineSnapshot,
): AuthorizationResult => {
  const denial = RULES[call.tool](agent, call.parameters, state);
  return denial === null
    ? { ok: true }
    : { ok: false, reasonCode: "PERMISSION_DENIED", message: denial };
};
