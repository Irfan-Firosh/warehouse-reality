/**
 * First-come-first-served baseline. Deterministic rules per role, one tool call
 * per turn, derived only from the TurnInput (observation, inbox, own outbox).
 * It never calls a model or the network, so it also serves as the budget
 * fallback. Only the dock lead can see docks and only the driver sees cargo, so
 * facts a role cannot observe come from the BaselinePolicy.
 */

import type { Deliberator, TurnDecision, TurnInput } from "../../types/run";
import type { AgentMessage, AgentToolCall } from "../agents/types";
import { D108 } from "./scenarios/d108";

/**
 * Baseline policy for the synthetic/scenario rehearsal, not facility data:
 * how far ahead a booked window starts, how long it lasts, and how long an
 * offer stays open. Same values as the scripted D-108 loop.
 */
const WINDOW_START_OFFSET_SEC = 600;
const WINDOW_DURATION_SEC = 2700;
const OFFER_TTL_SEC = 900;

const MODEL_LABEL = "baseline-fcfs";

export interface BaselinePolicy {
  /** Docks eligible as a relocation target, tried in ID order. */
  compatibleDocks: readonly string[];
  /** Agent id of the driver of each trailer. */
  driverByTrailer: Readonly<Record<string, string>>;
  yardAgentId: string;
  /** Cargo to unload once a trailer is at its new dock (docks cannot see cargo). */
  unload: { trailerId: string; shipmentId: string; quantity: number };
}

export const D108_BASELINE_POLICY: BaselinePolicy = {
  compatibleDocks: [D108.targetDock],
  driverByTrailer: { [D108.trailer]: D108.driverAgent },
  yardAgentId: D108.yardAgent,
  unload: {
    trailerId: D108.trailer,
    shipmentId: D108.shipment,
    quantity: D108.remainingPallets,
  },
};

const relocateTask = (trailerId: string, dockId: string): string =>
  `Relocate ${trailerId} to ${dockId}`;
const towTask = (trailerId: string, dockId: string, tractorId: string) =>
  `Tow ${trailerId} to ${dockId} with ${tractorId}`;
const RELOCATE = /^Relocate (\S+) to (\S+)$/;
const TOW = /^Tow (\S+) to (\S+) with (\S+)$/;

const textOf = (value: unknown): string =>
  typeof value === "string" ? value : "";

const commitmentOf = (m: AgentMessage): string =>
  textOf(m.payload.commitmentId);

const offers = (messages: AgentMessage[]): AgentMessage[] =>
  messages.filter((m) => m.purpose === "offer" && commitmentOf(m) !== "");

const hasStatus = (m: AgentMessage, status: string): boolean =>
  m.purpose === "status_update" && m.payload.status === status;

/** Commitment ids this agent has already answered or announced to someone. */
const handledIds = (agent: TurnInput["agent"]): Set<string> =>
  new Set(agent.outbox.map(commitmentOf).filter((id) => id !== ""));

/**
 * The proposer of a commitment accepts last, once every other participant it
 * offered to has accepted. Returns that commitment's id, if one just completed.
 */
const readyToAcceptOwn = (input: TurnInput): string | undefined => {
  const { agent, inbox } = input;
  const accepted = agent.inbox.filter((m) => m.purpose === "accept");
  for (const arrival of inbox.filter((m) => m.purpose === "accept")) {
    const id = commitmentOf(arrival);
    const offeredTo = offers(agent.outbox).filter(
      (o) => commitmentOf(o) === id,
    );
    const everyone = offeredTo.every((o) =>
      accepted.some(
        (a) => commitmentOf(a) === id && a.fromAgentId === o.toAgentId,
      ),
    );
    if (offeredTo.length > 0 && everyone) return id;
  }
  return undefined;
};

type Plan = { thought: string; toolCall?: AgentToolCall };

const accept = (
  input: TurnInput,
  commitmentId: string,
  thought: string,
): Plan => ({
  thought,
  toolCall: {
    tool: "accept",
    parameters: {
      participantId: input.agent.id,
      commitmentId,
      acceptedAtVersion: input.stateVersion,
    },
  },
});

const commit = (agentId: string, commitmentId: string): Plan => ({
  thought: `${commitmentId} is accepted by everyone; committing.`,
  toolCall: {
    tool: "commit",
    parameters: {
      commitmentId,
      requestId: `BASELINE-${agentId}-commit-${commitmentId}`,
    },
  },
});

/** Accept the earliest offer not yet answered. */
const acceptEarliestOffer = (input: TurnInput): Plan | undefined => {
  const handled = handledIds(input.agent);
  const pending = offers(input.agent.inbox).find(
    (o) => !handled.has(commitmentOf(o)),
  );
  return pending
    ? accept(input, commitmentOf(pending), "First come, first served: accept.")
    : undefined;
};

export class BaselineDeliberator implements Deliberator {
  readonly kind = "baseline" as const;

  constructor(private readonly policy: BaselinePolicy = D108_BASELINE_POLICY) {}

  async decide(input: TurnInput): Promise<TurnDecision> {
    const plan = this.plan(input) ?? {
      thought: "Nothing to do under first-come-first-served.",
    };
    return {
      ...plan,
      call: {
        agentId: input.agent.id,
        role: input.agent.role,
        tier: input.tier,
        model: MODEL_LABEL,
        isFallback: false,
        latencyMs: 0,
        promptTokens: null,
        completionTokens: null,
        logicalTime: input.logicalTime,
        stateVersion: input.stateVersion,
      },
    };
  }

  private plan(input: TurnInput): Plan | undefined {
    switch (input.agent.role) {
      case "driver":
        return acceptEarliestOffer(input);
      case "dock_lead":
        return this.dockLead(input);
      case "yard_controller":
        return this.yard(input);
      case "supervisor":
        return undefined;
    }
  }

  private dockLead(input: TurnInput): Plan | undefined {
    const { agent, inbox } = input;
    const { unload } = this.policy;

    if (
      inbox.some(
        (m) =>
          hasStatus(m, "moved") && m.payload.trailerId === unload.trailerId,
      )
    ) {
      return {
        thought: `${unload.trailerId} is at its new dock; resuming unload.`,
        toolCall: { tool: "executeUnload", parameters: { ...unload } },
      };
    }
    const ready = inbox.find((m) => hasStatus(m, "ready"));
    if (ready) return commit(agent.id, commitmentOf(ready));
    const own = readyToAcceptOwn(input);
    if (own) return accept(input, own, "Everyone else accepted; accepting.");

    return this.offerRelocation(input);
  }

  private offerRelocation(input: TurnInput): Plan | undefined {
    const { agent, observation } = input;
    const docks = Array.isArray(observation.docks)
      ? (observation.docks as Record<string, unknown>[])
      : [];
    const mine = docks.find((d) => d.id === agent.assignedEntityId);
    const trailerId = textOf(mine?.occupiedTrailerId);
    if (mine?.status !== "closed" || trailerId === "") return undefined;
    if (
      agent.outbox.some(
        (m) => RELOCATE.exec(textOf(m.payload.task))?.[1] === trailerId,
      )
    )
      return undefined;

    // The observation shows only the first holder of a dock, not its windows,
    // so any existing hold counts as overlapping.
    const target = this.policy.compatibleDocks.toSorted().find((id) => {
      const dock = docks.find((d) => d.id === id);
      return (
        dock?.status === "free" &&
        dock.occupiedTrailerId === undefined &&
        dock.reservedCommitmentId === undefined
      );
    });
    const driver = this.policy.driverByTrailer[trailerId];
    if (target === undefined || driver === undefined) return undefined;

    const start = input.logicalTime + WINDOW_START_OFFSET_SEC;
    return {
      thought: `${mine?.id} is closed; first free compatible dock is ${target}.`,
      toolCall: {
        tool: "propose",
        parameters: {
          task: relocateTask(trailerId, target),
          requiredResources: [
            {
              resourceId: target,
              type: "dock",
              startWindow: start,
              endWindow: start + WINDOW_DURATION_SEC,
            },
          ],
          expiresAt: input.logicalTime + OFFER_TTL_SEC,
          participants: [
            { agentId: agent.id, role: agent.role },
            { agentId: driver, role: "driver" },
            { agentId: this.policy.yardAgentId, role: "yard_controller" },
          ],
        },
      },
    };
  }

  private yard(input: TurnInput): Plan | undefined {
    const { agent, inbox, observation } = input;

    const tractors = Array.isArray(observation.tractors)
      ? (observation.tractors as Record<string, unknown>[])
      : [];
    const held = textOf(
      tractors.find((t) => t.id === agent.assignedEntityId)
        ?.assignedCommitmentId,
    );
    const tow = agent.outbox
      .filter((m) => m.purpose === "offer" && commitmentOf(m) === held)
      .map((m) => TOW.exec(textOf(m.payload.task)))
      .find((m) => m !== null);
    const [, trailerId, dockId, tractorId] = tow ?? [];
    const moved = agent.outbox.some(
      (m) => hasStatus(m, "moved") && m.payload.trailerId === trailerId,
    );
    if (tow && !moved) {
      return {
        thought: `${held} is committed; towing ${trailerId} to ${dockId}.`,
        toolCall: {
          tool: "executeMove",
          parameters: {
            trailerId,
            targetLocation: { kind: "dock", dockId },
            tractorId,
          },
        },
      };
    }

    const ready = inbox.find((m) => hasStatus(m, "ready"));
    if (ready) return commit(agent.id, commitmentOf(ready));
    const own = readyToAcceptOwn(input);
    if (own) return accept(input, own, "Everyone else accepted; accepting.");

    const relocation = this.committedRelocation(input);
    if (relocation) return this.offerTow(input, relocation);
    return acceptEarliestOffer(input);
  }

  /** A relocation offer the yard accepted whose commitment is now committed. */
  private committedRelocation(
    input: TurnInput,
  ): { trailerId: string; dockId: string } | undefined {
    const { agent, inbox } = input;
    for (const update of inbox.filter((m) => hasStatus(m, "committed"))) {
      const offer = offers(agent.inbox).find(
        (o) => commitmentOf(o) === commitmentOf(update),
      );
      const match = RELOCATE.exec(textOf(offer?.payload.task));
      if (match) return { trailerId: match[1], dockId: match[2] };
    }
    return undefined;
  }

  private offerTow(
    input: TurnInput,
    { trailerId, dockId }: { trailerId: string; dockId: string },
  ): Plan | undefined {
    const { agent } = input;
    const task = towTask(trailerId, dockId, agent.assignedEntityId);
    const driver = this.policy.driverByTrailer[trailerId];
    if (
      driver === undefined ||
      agent.outbox.some((m) => m.payload.task === task)
    )
      return undefined;
    const start = input.logicalTime;
    return {
      thought: `Dock ${dockId} is committed; offering the tow.`,
      toolCall: {
        tool: "propose",
        parameters: {
          task,
          requiredResources: [
            {
              resourceId: agent.assignedEntityId,
              type: "tractor",
              startWindow: start,
              endWindow: start + WINDOW_DURATION_SEC,
            },
          ],
          expiresAt: input.logicalTime + OFFER_TTL_SEC,
          participants: [
            { agentId: agent.id, role: agent.role },
            { agentId: driver, role: "driver" },
          ],
        },
      },
    };
  }
}
