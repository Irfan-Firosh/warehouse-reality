/**
 * Turn mechanics for a Run: authorize a tool call, route it through the
 * engine's tool contracts, and say who should hear about the result. The only
 * side effects are the engine tool calls themselves.
 */

import { AgentToolCallSchema } from "../agents/schemas";
import type { AgentMessage, AgentState, AgentToolCall } from "../agents/types";
import { isOpenCommitment } from "../engine/commitments";
import type { SimulationEngine } from "../engine/engine";
import type { EntityId, ToolResult } from "../engine/types";
import { authorize } from "./authorize";
import { toCommitmentProposal } from "./proposal-adapter";

export interface OutgoingMessage {
  to: EntityId;
  purpose: AgentMessage["purpose"];
  payload: Record<string, unknown>;
}

export interface ToolOutcome {
  outcome: "accepted" | "rejected" | "no_tool";
  reasonCode?: string;
  message?: string;
  messages: OutgoingMessage[];
  /** The actor keeps working after a successful state-changing call. */
  wakeSelf: boolean;
}

export interface ToolContext {
  engine: SimulationEngine;
  agent: AgentState;
  nextCommitmentId: () => string;
  /** commitmentId -> agent that proposed it. */
  proposers: Map<string, string>;
}

const NO_TOOL: ToolOutcome = {
  outcome: "no_tool",
  messages: [],
  wakeSelf: false,
};

const reject = (reasonCode: string, message: string): ToolOutcome => ({
  outcome: "rejected",
  reasonCode,
  message,
  messages: [],
  wakeSelf: false,
});

const fromResult = (
  result: ToolResult,
  messages: OutgoingMessage[],
): ToolOutcome =>
  result.success
    ? { outcome: "accepted", messages, wakeSelf: true }
    : reject(result.reasonCode ?? "INVARIANT_VIOLATION", result.message ?? "");

const othersIn = (
  engine: SimulationEngine,
  commitmentId: string,
  actorId: string,
): string[] =>
  (engine.getCommitment(commitmentId)?.participants ?? [])
    .map((p) => p.agentId)
    .filter((id) => id !== actorId);

/** Participants of open commitments that reserve any of `keys`. */
const stakeholders = (
  engine: SimulationEngine,
  keys: (string | undefined)[],
  actorId: string,
): string[] => {
  const wanted = new Set(keys.filter((k): k is string => k !== undefined));
  const ids = new Set<string>();
  for (const [, c] of engine.createCheckpoint().state.commitments) {
    if (!isOpenCommitment(c)) continue;
    if (!c.requiredResources.some((r) => wanted.has(r.resourceId))) continue;
    for (const p of c.participants)
      if (p.agentId !== actorId) ids.add(p.agentId);
  }
  return [...ids];
};

const update = (
  ids: string[],
  payload: Record<string, unknown>,
): OutgoingMessage[] =>
  ids.map((to) => ({ to, purpose: "status_update", payload }));

const execute = (
  call: ReturnType<typeof AgentToolCallSchema.parse>,
  ctx: ToolContext,
): ToolOutcome => {
  const { engine, agent, proposers } = ctx;
  switch (call.tool) {
    case "propose": {
      const adapted = toCommitmentProposal(call.parameters, {
        logicalTime: engine.getLogicalTime(),
        nextId: ctx.nextCommitmentId,
      });
      if (!adapted.ok) return reject(adapted.reasonCode, adapted.message);
      const { proposal } = adapted;
      const result = engine.propose(proposal);
      if (result.success) proposers.set(proposal.id, agent.id);
      const offers: OutgoingMessage[] = proposal.participants
        .filter((p) => p.agentId !== agent.id)
        .map((p) => ({
          to: p.agentId,
          purpose: "offer",
          payload: { commitmentId: proposal.id, task: proposal.task },
        }));
      return fromResult(result, offers);
    }
    case "accept": {
      const { commitmentId, participantId, acceptedAtVersion } =
        call.parameters;
      const result = engine.accept(
        participantId,
        commitmentId,
        acceptedAtVersion,
      );
      const proposer = proposers.get(commitmentId);
      const ready =
        engine.getCommitment(commitmentId)?.status === "ready_for_validation";
      const messages: OutgoingMessage[] = [];
      if (proposer && ready) {
        messages.push(...update([proposer], { commitmentId, status: "ready" }));
      } else if (proposer && proposer !== agent.id) {
        messages.push({
          to: proposer,
          purpose: "accept",
          payload: { commitmentId, acceptedAtVersion },
        });
      }
      return fromResult(result, messages);
    }
    case "commit": {
      const { commitmentId, requestId } = call.parameters;
      const result = engine.commit(commitmentId, requestId);
      return fromResult(
        result,
        update(othersIn(engine, commitmentId, agent.id), {
          commitmentId,
          status: "committed",
        }),
      );
    }
    case "cancel": {
      const { commitmentId, reason } = call.parameters;
      const result = engine.cancel(
        commitmentId,
        `cancel:${agent.id}:${commitmentId}`,
        reason,
      );
      const cancels: OutgoingMessage[] = othersIn(
        engine,
        commitmentId,
        agent.id,
      ).map((to) => ({
        to,
        purpose: "cancel",
        payload: { commitmentId, reason },
      }));
      return fromResult(result, cancels);
    }
    case "executeMove": {
      const { trailerId, targetLocation, tractorId } = call.parameters;
      const result = engine.executeMove(trailerId, targetLocation, tractorId);
      const dockId =
        targetLocation.kind === "dock" ? targetLocation.dockId : undefined;
      return fromResult(
        result,
        update(stakeholders(engine, [trailerId, tractorId, dockId], agent.id), {
          trailerId,
          status: "moved",
        }),
      );
    }
    case "executeUnload": {
      const { trailerId, shipmentId, quantity } = call.parameters;
      const result = engine.executeUnload(trailerId, shipmentId, quantity);
      const location = engine.getTrailer(trailerId)?.location;
      const dockId = location?.kind === "dock" ? location.dockId : undefined;
      return fromResult(
        result,
        update(stakeholders(engine, [trailerId, dockId], agent.id), {
          trailerId,
          shipmentId,
          quantity,
          status: "unloaded",
        }),
      );
    }
    case "escalate": {
      const messages: OutgoingMessage[] =
        agent.id === "SUP-1"
          ? []
          : [
              {
                to: "SUP-1",
                purpose: "escalate",
                payload: { ...call.parameters },
              },
            ];
      return { outcome: "accepted", messages, wakeSelf: false };
    }
    case "observe":
      return { outcome: "accepted", messages: [], wakeSelf: false };
    case "injectDisruption":
      return reject("PERMISSION_DENIED", "Agents may not inject disruptions.");
  }
};

/** observe → (decision supplied) → authorize → adapter/engine tool. */
export const runTool = (
  call: AgentToolCall | undefined,
  ctx: ToolContext,
): ToolOutcome => {
  if (!call) return NO_TOOL;
  const auth = authorize(ctx.agent, call, ctx.engine.createCheckpoint());
  if (!auth.ok) return reject(auth.reasonCode, auth.message);
  const parsed = AgentToolCallSchema.safeParse(call);
  if (!parsed.success)
    return reject("INVARIANT_VIOLATION", "Malformed tool call.");
  return execute(parsed.data, ctx);
};

/** Agents to wake for a disruption: the dock lead of the dock and the driver of its trailer. */
export const affectedAgentIds = (
  engine: SimulationEngine,
  agents: AgentState[],
  targetId: string,
): string[] => {
  const trailers = engine.createCheckpoint().state.trailers.map(([, t]) => t);
  const asTrailer = trailers.find((t) => t.id === targetId);
  const dockId =
    asTrailer?.location.kind === "dock"
      ? asTrailer.location.dockId
      : engine.getDock(targetId)?.id;
  const trailerIds = new Set(
    trailers
      .filter(
        (t) =>
          t.id === targetId ||
          (dockId &&
            t.location.kind === "dock" &&
            t.location.dockId === dockId),
      )
      .map((t) => t.id),
  );
  const leads = agents.filter(
    (a) =>
      a.role === "dock_lead" &&
      dockId !== undefined &&
      a.assignedEntityId === dockId,
  );
  const drivers = agents.filter(
    (a) => a.role === "driver" && trailerIds.has(a.assignedEntityId),
  );
  const woken = [...leads, ...drivers].map((a) => a.id);
  return woken.length > 0
    ? woken
    : agents.filter((a) => a.role === "supervisor").map((a) => a.id);
};
