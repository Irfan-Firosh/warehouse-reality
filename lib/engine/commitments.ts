/**
 * Atomic Two-Phase Commitment Engine (PRD §9, §10, §18 C01–C06).
 * Enforces atomic reservations, stale-version checks, and idempotent execution.
 */

import { checkReservationAvailability } from "./invariants";
import type {
  CommitmentEntity,
  CommitmentParticipant,
  EngineEvent,
  EngineState,
  EntityId,
  ResourceReservation,
  ToolResult,
} from "./types";

export interface CommitmentProposal {
  id: EntityId;
  task: string;
  participants: { agentId: EntityId; role: string }[];
  requiredResources: ResourceReservation[];
  expiresInSeconds: number;
}

/**
 * Creates a candidate task window without allocating physical resources (C01).
 */
export const proposeCommitment = (
  proposal: CommitmentProposal,
  state: EngineState,
  emitEvent: (evt: Omit<EngineEvent, "sequence">) => EngineEvent,
): ToolResult => {
  if (state.commitments.has(proposal.id)) {
    return {
      success: false,
      reasonCode: "INVARIANT_VIOLATION",
      message: `Commitment ${proposal.id} already exists.`,
      affectedIds: [proposal.id],
      stateVersion: state.stateVersion,
      eventIds: [],
    };
  }

  const participants: CommitmentParticipant[] = proposal.participants.map(
    (p) => ({
      agentId: p.agentId,
      role: p.role,
      accepted: false,
    }),
  );

  const expiresAt = state.logicalTime + proposal.expiresInSeconds;

  const commitment: CommitmentEntity = {
    id: proposal.id,
    task: proposal.task,
    status: "proposed",
    participants,
    requiredResources: proposal.requiredResources,
    createdAt: state.logicalTime,
    expiresAt,
    stateVersion: state.stateVersion,
  };

  state.commitments.set(proposal.id, commitment);

  const event = emitEvent({
    id: `E-${proposal.id}-PROP`,
    logicalTime: state.logicalTime,
    type: "commitment_proposed",
    affectedIds: [proposal.id, ...participants.map((p) => p.agentId)],
    payload: { task: proposal.task, expiresAt },
    stateVersion: state.stateVersion,
  });

  return {
    success: true,
    affectedIds: [proposal.id],
    stateVersion: state.stateVersion,
    eventIds: [event.id],
  };
};

/**
 * Record participant intent against a specific offer version (C01: no resources locked).
 */
export const acceptOffer = (
  participantId: EntityId,
  commitmentId: EntityId,
  acceptedAtVersion: number,
  state: EngineState,
  emitEvent: (evt: Omit<EngineEvent, "sequence">) => EngineEvent,
): ToolResult => {
  const commitment = state.commitments.get(commitmentId);
  if (!commitment) {
    return {
      success: false,
      reasonCode: "NOT_FOUND",
      message: `Commitment ${commitmentId} not found.`,
      affectedIds: [commitmentId],
      stateVersion: state.stateVersion,
      eventIds: [],
    };
  }

  if (
    commitment.status !== "proposed" &&
    commitment.status !== "partially_accepted"
  ) {
    return {
      success: false,
      reasonCode: "INVARIANT_VIOLATION",
      message: `Cannot accept commitment ${commitmentId} in status ${commitment.status}.`,
      affectedIds: [commitmentId],
      stateVersion: state.stateVersion,
      eventIds: [],
    };
  }

  if (state.logicalTime > commitment.expiresAt) {
    commitment.status = "expired";
    return {
      success: false,
      reasonCode: "OFFER_EXPIRED",
      message: `Offer for commitment ${commitmentId} expired at ${commitment.expiresAt}.`,
      affectedIds: [commitmentId],
      stateVersion: state.stateVersion,
      eventIds: [],
    };
  }

  const participant = commitment.participants.find(
    (p) => p.agentId === participantId,
  );
  if (!participant) {
    return {
      success: false,
      reasonCode: "INVARIANT_VIOLATION",
      message: `Agent ${participantId} is not a participant in commitment ${commitmentId}.`,
      affectedIds: [commitmentId, participantId],
      stateVersion: state.stateVersion,
      eventIds: [],
    };
  }

  participant.accepted = true;
  participant.acceptedAtVersion = acceptedAtVersion;

  const allAccepted = commitment.participants.every((p) => p.accepted);
  commitment.status = allAccepted
    ? "ready_for_validation"
    : "partially_accepted";

  const event = emitEvent({
    id: `E-${commitmentId}-ACC-${participantId}`,
    logicalTime: state.logicalTime,
    type: "offer_accepted",
    affectedIds: [commitmentId, participantId],
    payload: { allAccepted, acceptedAtVersion },
    stateVersion: state.stateVersion,
  });

  return {
    success: true,
    affectedIds: [commitmentId, participantId],
    stateVersion: state.stateVersion,
    eventIds: [event.id],
  };
};

/**
 * C02: Atomically validate and reserve all required resources with idempotent request ID.
 * C03: Contending requests cannot both win exclusive resources.
 * C04: Duplicate request IDs do not duplicate actions.
 * C05: Stale accepted versions fail with structured reason STALE_VERSION.
 */
export const commitAllocation = (
  commitmentId: EntityId,
  requestId: string,
  processedRequests: Map<string, ToolResult>,
  state: EngineState,
  emitEvent: (evt: Omit<EngineEvent, "sequence">) => EngineEvent,
): ToolResult => {
  // C04: Idempotency deduplication check
  const cached = processedRequests.get(requestId);
  if (cached) {
    return cached;
  }

  const commitment = state.commitments.get(commitmentId);
  if (!commitment) {
    const res: ToolResult = {
      success: false,
      reasonCode: "NOT_FOUND",
      message: `Commitment ${commitmentId} not found.`,
      affectedIds: [commitmentId],
      stateVersion: state.stateVersion,
      eventIds: [],
    };
    processedRequests.set(requestId, res);
    return res;
  }

  // Check if all participants accepted
  const incompleteParticipant = commitment.participants.find(
    (p) => !p.accepted,
  );
  if (incompleteParticipant) {
    const res: ToolResult = {
      success: false,
      reasonCode: "PARTICIPANTS_INCOMPLETE",
      message: `Cannot commit: participant ${incompleteParticipant.agentId} has not accepted.`,
      affectedIds: [commitmentId, incompleteParticipant.agentId],
      stateVersion: state.stateVersion,
      eventIds: [],
    };
    processedRequests.set(requestId, res);
    return res;
  }

  // C05: Stale Version Check
  // If the engine state advanced since any participant accepted, fail with STALE_VERSION
  const staleParticipant = commitment.participants.find(
    (p) =>
      p.acceptedAtVersion !== undefined &&
      p.acceptedAtVersion < state.stateVersion,
  );
  if (staleParticipant) {
    commitment.status = "rejected";
    commitment.rejectionReason = `STALE_VERSION (accepted v${staleParticipant.acceptedAtVersion}, current v${state.stateVersion})`;

    const failEvent = emitEvent({
      id: `E-${commitmentId}-REJ-STALE`,
      logicalTime: state.logicalTime,
      type: "commitment_rejected",
      affectedIds: [commitmentId, staleParticipant.agentId],
      payload: {
        reasonCode: "STALE_VERSION",
        acceptedAtVersion: staleParticipant.acceptedAtVersion,
        currentVersion: state.stateVersion,
      },
      stateVersion: state.stateVersion,
    });

    const res: ToolResult = {
      success: false,
      reasonCode: "STALE_VERSION",
      message: commitment.rejectionReason,
      affectedIds: [commitmentId],
      stateVersion: state.stateVersion,
      eventIds: [failEvent.id],
    };
    processedRequests.set(requestId, res);
    return res;
  }

  // Check Expiration
  if (state.logicalTime > commitment.expiresAt) {
    commitment.status = "expired";
    const res: ToolResult = {
      success: false,
      reasonCode: "OFFER_EXPIRED",
      message: `Commitment offer expired at ${commitment.expiresAt}`,
      affectedIds: [commitmentId],
      stateVersion: state.stateVersion,
      eventIds: [],
    };
    processedRequests.set(requestId, res);
    return res;
  }

  // C02 & C03: Atomic resource reservation check (all-or-nothing)
  for (const res of commitment.requiredResources) {
    const check = checkReservationAvailability(res, state, commitmentId);
    if (!check.ok) {
      commitment.status = "rejected";
      commitment.rejectionReason = check.violation;

      const failEvent = emitEvent({
        id: `E-${commitmentId}-REJ-RES`,
        logicalTime: state.logicalTime,
        type: "commitment_rejected",
        affectedIds: [commitmentId, res.resourceId],
        payload: { violation: check.violation, reasonCode: check.reasonCode },
        stateVersion: state.stateVersion,
      });

      const failureResult: ToolResult = {
        success: false,
        reasonCode: check.reasonCode,
        message: check.violation,
        affectedIds: [commitmentId, res.resourceId],
        stateVersion: state.stateVersion,
        eventIds: [failEvent.id],
      };
      processedRequests.set(requestId, failureResult);
      return failureResult;
    }
  }

  // All resources verified available -> Atomically lock all required resources
  for (const res of commitment.requiredResources) {
    switch (res.type) {
      case "dock": {
        const dock = state.docks.get(res.resourceId);
        if (dock) dock.reservedCommitmentId = commitmentId;
        break;
      }
      case "stall": {
        const stall = state.stalls.get(res.resourceId);
        if (stall) stall.reservedCommitmentId = commitmentId;
        break;
      }
      case "equipment": {
        const eq = state.equipment.get(res.resourceId);
        if (eq) eq.assignedCommitmentId = commitmentId;
        break;
      }
      case "worker": {
        const worker = state.workers.get(res.resourceId);
        if (worker) worker.assignedCommitmentId = commitmentId;
        break;
      }
      case "trailer": {
        const trailer = state.trailers.get(res.resourceId);
        if (trailer) trailer.assignedCommitmentId = commitmentId;
        break;
      }
      case "tractor": {
        const tractor = state.tractors.get(res.resourceId);
        if (tractor) tractor.assignedCommitmentId = commitmentId;
        break;
      }
    }
  }

  // Update commitment to committed
  commitment.status = "committed";
  commitment.committedAt = state.logicalTime;
  state.stateVersion += 1; // Monotonically advance version

  const commitEvent = emitEvent({
    id: `E-${commitmentId}-COMMITTED`,
    logicalTime: state.logicalTime,
    type: "commitment_committed",
    affectedIds: [
      commitmentId,
      ...commitment.requiredResources.map((r) => r.resourceId),
    ],
    payload: { stateVersion: state.stateVersion, task: commitment.task },
    stateVersion: state.stateVersion,
  });

  const successResult: ToolResult = {
    success: true,
    affectedIds: [commitmentId],
    stateVersion: state.stateVersion,
    eventIds: [commitEvent.id],
  };

  processedRequests.set(requestId, successResult);
  return successResult;
};

/**
 * C06: Expire uncommitted candidate offers that have passed their deadline.
 */
export const expireStaleOffers = (
  state: EngineState,
  emitEvent: (evt: Omit<EngineEvent, "sequence">) => EngineEvent,
): EntityId[] => {
  const expiredIds: EntityId[] = [];
  for (const commitment of state.commitments.values()) {
    if (
      (commitment.status === "proposed" ||
        commitment.status === "partially_accepted") &&
      state.logicalTime >= commitment.expiresAt
    ) {
      commitment.status = "expired";
      expiredIds.push(commitment.id);

      emitEvent({
        id: `E-${commitment.id}-EXPIRED`,
        logicalTime: state.logicalTime,
        type: "offer_expired",
        affectedIds: [commitment.id],
        payload: { expiresAt: commitment.expiresAt },
        stateVersion: state.stateVersion,
      });
    }
  }
  return expiredIds;
};

const OPEN_STATUSES: readonly CommitmentEntity["status"][] = [
  "proposed",
  "partially_accepted",
  "ready_for_validation",
  "committed",
  "executing",
];

export const isOpenCommitment = (commitment: CommitmentEntity): boolean =>
  OPEN_STATUSES.includes(commitment.status);

/**
 * Cancel a commitment, idempotent by request ID. Releases every reservation the
 * commitment holds. Partial physical work (cargo already transferred) is kept.
 */
export const cancelCommitment = (
  commitmentId: EntityId,
  requestId: string,
  reason: string,
  processedRequests: Map<string, ToolResult>,
  state: EngineState,
  emitEvent: (evt: Omit<EngineEvent, "sequence">) => EngineEvent,
): ToolResult => {
  const cached = processedRequests.get(requestId);
  if (cached) {
    return cached;
  }

  const commitment = state.commitments.get(commitmentId);
  if (!commitment) {
    const res: ToolResult = {
      success: false,
      reasonCode: "NOT_FOUND",
      message: `Commitment ${commitmentId} not found.`,
      affectedIds: [commitmentId],
      stateVersion: state.stateVersion,
      eventIds: [],
    };
    processedRequests.set(requestId, res);
    return res;
  }

  if (!isOpenCommitment(commitment)) {
    const res: ToolResult = {
      success: false,
      reasonCode: "INVARIANT_VIOLATION",
      message: `Cannot cancel commitment ${commitmentId} in status ${commitment.status}.`,
      affectedIds: [commitmentId],
      stateVersion: state.stateVersion,
      eventIds: [],
    };
    processedRequests.set(requestId, res);
    return res;
  }

  const wasExecuting = commitment.status === "executing";
  const released: EntityId[] = [];

  for (const dock of state.docks.values()) {
    if (dock.reservedCommitmentId !== commitmentId) continue;
    dock.reservedCommitmentId = undefined;
    if (dock.status === "reserved") dock.status = "free";
    released.push(dock.id);
  }
  for (const stall of state.stalls.values()) {
    if (stall.reservedCommitmentId !== commitmentId) continue;
    stall.reservedCommitmentId = undefined;
    released.push(stall.id);
  }
  for (const holders of [
    state.equipment,
    state.workers,
    state.trailers,
    state.tractors,
  ] as Map<EntityId, { id: EntityId; assignedCommitmentId?: EntityId }>[]) {
    for (const holder of holders.values()) {
      if (holder.assignedCommitmentId !== commitmentId) continue;
      holder.assignedCommitmentId = undefined;
      released.push(holder.id);
    }
  }

  commitment.status = "cancelled";
  commitment.rejectionReason = reason;
  state.stateVersion += 1;

  const event = emitEvent({
    id: `E-${commitmentId}-CANCELLED`,
    logicalTime: state.logicalTime,
    type: "commitment_cancelled",
    affectedIds: [commitmentId, ...released],
    payload: { reason, partialWorkKept: wasExecuting, released },
    stateVersion: state.stateVersion,
  });

  const result: ToolResult = {
    success: true,
    affectedIds: [commitmentId, ...released],
    stateVersion: state.stateVersion,
    eventIds: [event.id],
  };
  processedRequests.set(requestId, result);
  return result;
};
