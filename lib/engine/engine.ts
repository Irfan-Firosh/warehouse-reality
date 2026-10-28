/**
 * Authoritative Simulation Engine (PRD §11, §14, §16).
 * Pure deterministic TypeScript; owns physical state, logical clock, reservations, and event ordering.
 */

import {
  type CommitmentProposal,
  acceptOffer as engineAcceptOffer,
  cancelCommitment as engineCancelCommitment,
  commitAllocation as engineCommitAllocation,
  proposeCommitment as engineProposeCommitment,
  expireStaleOffers,
  isOpenCommitment,
} from "./commitments";
import {
  checkCargoTransferConservation,
  checkTrailerSingleLocation,
} from "./invariants";

import type {
  CommitmentEntity,
  DockEntity,
  EngineEvent,
  EngineSnapshot,
  EngineState,
  EntityId,
  EquipmentEntity,
  PhysicalLocation,
  ShipmentEntity,
  StallEntity,
  ToolResult,
  TractorEntity,
  TrailerEntity,
  WorkerEntity,
} from "./types";

export interface EngineInitOptions {
  startTime?: number; // seconds from midnight, default 50400 (14:00:00)
  dockCount?: number; // default 182 S1
  rampCount?: number; // default 4 S1
  stallCount?: number; // default 235 S1
}

export class SimulationEngine {
  private state: EngineState;
  private eventLog: EngineEvent[] = [];
  private eventQueue: EngineEvent[] = [];
  private sequenceCounter = 0;
  private processedRequests = new Map<string, ToolResult>();

  constructor(options: EngineInitOptions = {}) {
    const startTime = options.startTime ?? 50400; // 14:00:00
    const dockCount = options.dockCount ?? 182;
    const rampCount = options.rampCount ?? 4;
    const stallCount = options.stallCount ?? 235;

    const docks = new Map<EntityId, DockEntity>();
    for (let i = 0; i < dockCount; i++) {
      const id = `D-${String(i + 1).padStart(3, "0")}`;
      docks.set(id, { id, kind: "dock", status: "free" });
    }
    for (let k = 0; k < rampCount; k++) {
      const id = `R-${String(k + 1).padStart(2, "0")}`;
      docks.set(id, { id, kind: "ramp", status: "free" });
    }

    const stalls = new Map<EntityId, StallEntity>();
    for (let j = 0; j < stallCount; j++) {
      const id = `P-${String(j + 1).padStart(3, "0")}`;
      stalls.set(id, { id });
    }

    this.state = {
      logicalTime: startTime,
      stateVersion: 1,
      docks,
      stalls,
      trailers: new Map(),
      tractors: new Map(),
      equipment: new Map(),
      workers: new Map(),
      shipments: new Map(),
      commitments: new Map(),
    };
  }

  // --- Clock and Event Mechanics ---

  public getLogicalTime(): number {
    return this.state.logicalTime;
  }

  public getStateVersion(): number {
    return this.state.stateVersion;
  }

  public getEventLog(): readonly EngineEvent[] {
    return this.eventLog;
  }

  public emitEvent(evt: Omit<EngineEvent, "sequence">): EngineEvent {
    this.sequenceCounter += 1;
    const fullEvent: EngineEvent = {
      ...evt,
      sequence: this.sequenceCounter,
    };
    this.eventLog.push(fullEvent);
    return fullEvent;
  }

  public scheduleEvent(evt: Omit<EngineEvent, "sequence">): void {
    this.sequenceCounter += 1;
    const fullEvent: EngineEvent = {
      ...evt,
      sequence: this.sequenceCounter,
    };
    // Keep priority queue sorted by logical time ascending, then sequence
    this.eventQueue.push(fullEvent);
    this.eventQueue.sort(
      (a, b) => a.logicalTime - b.logicalTime || a.sequence - b.sequence,
    );
  }

  public step(): EngineEvent | undefined {
    // Check and expire stale offers at current logical time
    expireStaleOffers(this.state, (e) => this.emitEvent(e));

    const nextEvent = this.eventQueue.shift();
    if (!nextEvent) return undefined;

    // Advance clock to next event time
    this.state.logicalTime = nextEvent.logicalTime;
    this.eventLog.push(nextEvent);

    return nextEvent;
  }

  /**
   * Consume queued events with logicalTime <= t in time order, then set the
   * clock to t. Time never moves backwards: a t earlier than now consumes
   * nothing and leaves the clock unchanged.
   */
  public advanceUntil(t: number): EngineEvent[] {
    const consumed: EngineEvent[] = [];
    while (this.eventQueue.length > 0 && this.eventQueue[0].logicalTime <= t) {
      const next = this.eventQueue.shift();
      if (!next) break;
      this.state.logicalTime = Math.max(
        this.state.logicalTime,
        next.logicalTime,
      );
      this.eventLog.push(next);
      consumed.push(next);
    }
    this.state.logicalTime = Math.max(this.state.logicalTime, t);
    return consumed;
  }

  // --- Entity Management (Setup and State) ---

  public addTrailer(trailer: TrailerEntity): void {
    this.state.trailers.set(trailer.id, trailer);

    // If placed at dock or stall, mark physical occupancy
    if (trailer.location.kind === "dock") {
      const dock = this.state.docks.get(trailer.location.dockId);
      if (dock) {
        dock.status = "occupied";
        dock.occupiedTrailerId = trailer.id;
      }
    } else if (trailer.location.kind === "stall") {
      const stall = this.state.stalls.get(trailer.location.stallId);
      if (stall) {
        stall.occupiedTrailerId = trailer.id;
      }
    }
  }

  public addTractor(tractor: TractorEntity): void {
    this.state.tractors.set(tractor.id, tractor);
  }

  public addEquipment(eq: EquipmentEntity): void {
    this.state.equipment.set(eq.id, eq);
  }

  public addWorker(worker: WorkerEntity): void {
    this.state.workers.set(worker.id, worker);
  }

  public addShipment(shipment: ShipmentEntity): void {
    this.state.shipments.set(shipment.id, shipment);
  }

  public getTrailer(id: EntityId): TrailerEntity | undefined {
    return this.state.trailers.get(id);
  }

  public getDock(id: EntityId): DockEntity | undefined {
    return this.state.docks.get(id);
  }

  public getStall(id: EntityId): StallEntity | undefined {
    return this.state.stalls.get(id);
  }

  public getCommitment(id: EntityId): CommitmentEntity | undefined {
    return this.state.commitments.get(id);
  }

  // --- Tool Contracts: Two-Phase Commitments (PRD §10) ---

  public propose(proposal: CommitmentProposal): ToolResult {
    return engineProposeCommitment(proposal, this.state, (e) =>
      this.emitEvent(e),
    );
  }

  public accept(
    participantId: EntityId,
    commitmentId: EntityId,
    acceptedAtVersion: number,
  ): ToolResult {
    return engineAcceptOffer(
      participantId,
      commitmentId,
      acceptedAtVersion,
      this.state,
      (e) => this.emitEvent(e),
    );
  }

  public commit(commitmentId: EntityId, requestId: string): ToolResult {
    return engineCommitAllocation(
      commitmentId,
      requestId,
      this.processedRequests,
      this.state,
      (e) => this.emitEvent(e),
    );
  }

  public cancel(
    commitmentId: EntityId,
    requestId: string,
    reason: string,
  ): ToolResult {
    return engineCancelCommitment(
      commitmentId,
      requestId,
      reason,
      this.processedRequests,
      this.state,
      (e) => this.emitEvent(e),
    );
  }

  // --- Physical Movement and Service Actions ---

  /**
   * P01 & P05: Execute physical relocation of a trailer.
   * Enforces single location invariant and lane transitions.
   */
  public executeMove(
    trailerId: EntityId,
    targetLocation: PhysicalLocation,
    tractorId?: EntityId,
  ): ToolResult {
    const trailer = this.state.trailers.get(trailerId);
    if (!trailer) {
      return {
        success: false,
        reasonCode: "INVARIANT_VIOLATION",
        message: `Trailer ${trailerId} does not exist.`,
        affectedIds: [trailerId],
        stateVersion: this.state.stateVersion,
        eventIds: [],
      };
    }

    const check = checkTrailerSingleLocation(
      trailerId,
      targetLocation,
      this.state,
    );
    if (!check.ok) {
      return {
        success: false,
        reasonCode: check.reasonCode,
        message: check.violation,
        affectedIds: [trailerId],
        stateVersion: this.state.stateVersion,
        eventIds: [],
      };
    }

    // Release old location
    if (trailer.location.kind === "dock") {
      const oldDock = this.state.docks.get(trailer.location.dockId);
      if (oldDock && oldDock.occupiedTrailerId === trailerId) {
        oldDock.occupiedTrailerId = undefined;
        oldDock.status = oldDock.reservedCommitmentId ? "reserved" : "free";
      }
    } else if (trailer.location.kind === "stall") {
      const oldStall = this.state.stalls.get(trailer.location.stallId);
      if (oldStall && oldStall.occupiedTrailerId === trailerId) {
        oldStall.occupiedTrailerId = undefined;
      }
    }

    // Acquire new location
    if (targetLocation.kind === "dock") {
      const newDock = this.state.docks.get(targetLocation.dockId);
      if (newDock) {
        newDock.occupiedTrailerId = trailerId;
        newDock.status = "occupied";
      }
    } else if (targetLocation.kind === "stall") {
      const newStall = this.state.stalls.get(targetLocation.stallId);
      if (newStall) {
        newStall.occupiedTrailerId = trailerId;
      }
    }

    const prevLocation = trailer.location;
    trailer.location = targetLocation;
    this.state.stateVersion += 1;

    const event = this.emitEvent({
      id: `E-${trailerId}-MOVE`,
      logicalTime: this.state.logicalTime,
      type: "trailer_moved",
      affectedIds: [trailerId, ...(tractorId ? [tractorId] : [])],
      payload: { from: prevLocation, to: targetLocation, tractorId },
      stateVersion: this.state.stateVersion,
    });

    return {
      success: true,
      affectedIds: [trailerId],
      stateVersion: this.state.stateVersion,
      eventIds: [event.id],
    };
  }

  /**
   * P02: Unload cargo from a trailer at a dock with strict quantity conservation.
   */
  public executeUnload(
    trailerId: EntityId,
    shipmentId: EntityId,
    quantity: number,
  ): ToolResult {
    const check = checkCargoTransferConservation(
      trailerId,
      shipmentId,
      quantity,
      this.state,
    );
    if (!check.ok) {
      return {
        success: false,
        reasonCode: check.reasonCode,
        message: check.violation,
        affectedIds: [trailerId, shipmentId],
        stateVersion: this.state.stateVersion,
        eventIds: [],
      };
    }

    const trailer = this.state.trailers.get(trailerId);
    if (!trailer) {
      return {
        success: false,
        reasonCode: "INVARIANT_VIOLATION",
        message: `Trailer ${trailerId} missing.`,
        affectedIds: [trailerId],
        stateVersion: this.state.stateVersion,
        eventIds: [],
      };
    }

    const cargo = trailer.cargo.find((c) => c.shipmentId === shipmentId);
    if (!cargo) {
      return {
        success: false,
        reasonCode: "INVARIANT_VIOLATION",
        message: `Cargo ${shipmentId} missing from trailer ${trailerId}.`,
        affectedIds: [trailerId, shipmentId],
        stateVersion: this.state.stateVersion,
        eventIds: [],
      };
    }

    // Conserve cargo quantity
    cargo.quantity -= quantity;

    // First transfer moves the owning commitment into execution
    const owner = trailer.assignedCommitmentId
      ? this.state.commitments.get(trailer.assignedCommitmentId)
      : undefined;
    if (owner?.status === "committed") owner.status = "executing";

    const shipment = this.state.shipments.get(shipmentId);
    if (shipment) {
      shipment.transferredQuantity += quantity;
    }

    this.state.stateVersion += 1;

    const event = this.emitEvent({
      id: `E-${trailerId}-UNLOAD`,
      logicalTime: this.state.logicalTime,
      type: "cargo_unloaded",
      affectedIds: [trailerId, shipmentId],
      payload: { quantity, remainingOnBoard: cargo.quantity },
      stateVersion: this.state.stateVersion,
    });

    return {
      success: true,
      affectedIds: [trailerId, shipmentId],
      stateVersion: this.state.stateVersion,
      eventIds: [event.id],
    };
  }

  // --- Operator Disruption Injection (PRD §11.3) ---

  public injectDisruption(
    disruptionId: string,
    type: "dock_closure" | "equipment_failure",
    targetId: EntityId,
  ): ToolResult {
    if (type === "dock_closure") {
      const dock = this.state.docks.get(targetId);
      if (!dock) {
        return {
          success: false,
          reasonCode: "NOT_FOUND",
          message: `Dock ${targetId} not found.`,
          affectedIds: [targetId],
          stateVersion: this.state.stateVersion,
          eventIds: [],
        };
      }

      dock.status = "closed";
      this.state.stateVersion += 1;

      const event = this.emitEvent({
        id: `E-${disruptionId}-CLOSED`,
        logicalTime: this.state.logicalTime,
        type: "dock_closed_disruption",
        affectedIds: [targetId],
        payload: { disruptionId, targetId },
        stateVersion: this.state.stateVersion,
      });

      return {
        success: true,
        affectedIds: [targetId],
        stateVersion: this.state.stateVersion,
        eventIds: [event.id],
      };
    }

    if (type === "equipment_failure") {
      const eq = this.state.equipment.get(targetId);
      if (!eq) {
        return {
          success: false,
          reasonCode: "NOT_FOUND",
          message: `Equipment ${targetId} not found.`,
          affectedIds: [targetId],
          stateVersion: this.state.stateVersion,
          eventIds: [],
        };
      }

      eq.status = "failed";
      this.state.stateVersion += 1;

      const event = this.emitEvent({
        id: `E-${disruptionId}-FAIL`,
        logicalTime: this.state.logicalTime,
        type: "equipment_failed_disruption",
        affectedIds: [targetId],
        payload: { disruptionId, targetId },
        stateVersion: this.state.stateVersion,
      });

      return {
        success: true,
        affectedIds: [targetId],
        stateVersion: this.state.stateVersion,
        eventIds: [event.id],
      };
    }

    return {
      success: false,
      reasonCode: "INVARIANT_VIOLATION",
      message: `Unsupported disruption type ${type}`,
      affectedIds: [targetId],
      stateVersion: this.state.stateVersion,
      eventIds: [],
    };
  }

  // --- Scoped Agent Observations (PRD §8.1) ---

  public observe(
    role: "driver" | "dock_lead" | "yard_controller" | "supervisor",
    agentEntityId: EntityId,
  ): Record<string, unknown> {
    const time = this.state.logicalTime;
    const version = this.state.stateVersion;

    if (role === "driver") {
      // Driver only observes own trailer, coupled status, and assigned commitments
      const trailer = this.state.trailers.get(agentEntityId);
      return {
        time,
        version,
        role: "driver",
        trailerId: agentEntityId,
        location: trailer?.location,
        cargo: trailer?.cargo,
        assignedCommitmentId: trailer?.assignedCommitmentId,
      };
    }

    if (role === "dock_lead") {
      // Dock lead observes status of dock doors and active unload commitments
      const dockStatuses = Array.from(this.state.docks.values()).map((d) => ({
        id: d.id,
        status: d.status,
        occupiedTrailerId: d.occupiedTrailerId,
        reservedCommitmentId: d.reservedCommitmentId,
      }));
      return {
        time,
        version,
        role: "dock_lead",
        docks: dockStatuses,
      };
    }

    if (role === "yard_controller") {
      // Yard controller observes parking stalls, tractors, and trailer locations
      const stallStatuses = Array.from(this.state.stalls.values()).map((s) => ({
        id: s.id,
        occupiedTrailerId: s.occupiedTrailerId,
        reservedCommitmentId: s.reservedCommitmentId,
      }));
      return {
        time,
        version,
        role: "yard_controller",
        stalls: stallStatuses,
        tractors: Array.from(this.state.tractors.values()),
      };
    }

    if (role === "supervisor") {
      // Supervisor observes open commitments and the most recent events
      return {
        time,
        version,
        role: "supervisor",
        openCommitments: Array.from(this.state.commitments.values())
          .filter(isOpenCommitment)
          .map((c) => ({
            id: c.id,
            task: c.task,
            status: c.status,
            participants: c.participants.map((p) => p.agentId),
          })),
        recentEvents: this.eventLog.slice(-10),
      };
    }

    return { time, version, error: "Unrecognized role" };
  }

  // --- Checkpoints and Deterministic Replay (PRD §14, §16, R01) ---

  public createCheckpoint(): EngineSnapshot {
    return {
      logicalTime: this.state.logicalTime,
      stateVersion: this.state.stateVersion,
      eventCount: this.eventLog.length,
      state: {
        docks: Array.from(this.state.docks.entries()).map(([k, v]) => [
          k,
          { ...v },
        ]),
        stalls: Array.from(this.state.stalls.entries()).map(([k, v]) => [
          k,
          { ...v },
        ]),
        trailers: Array.from(this.state.trailers.entries()).map(([k, v]) => [
          k,
          { ...v, cargo: v.cargo.map((c) => ({ ...c })) },
        ]),
        tractors: Array.from(this.state.tractors.entries()).map(([k, v]) => [
          k,
          { ...v },
        ]),
        equipment: Array.from(this.state.equipment.entries()).map(([k, v]) => [
          k,
          { ...v },
        ]),
        workers: Array.from(this.state.workers.entries()).map(([k, v]) => [
          k,
          { ...v },
        ]),
        shipments: Array.from(this.state.shipments.entries()).map(([k, v]) => [
          k,
          { ...v },
        ]),
        commitments: Array.from(this.state.commitments.entries()).map(
          ([k, v]) => [
            k,
            {
              ...v,
              participants: v.participants.map((p) => ({ ...p })),
              requiredResources: v.requiredResources.map((r) => ({ ...r })),
            },
          ],
        ),
      },
      queue: this.eventQueue.map((e) => ({
        ...e,
        affectedIds: [...e.affectedIds],
        payload: e.payload ? { ...e.payload } : undefined,
      })),
      processed: Array.from(this.processedRequests.entries()).map(([k, v]) => [
        k,
        { ...v },
      ]),
      sequence: this.sequenceCounter,
    };
  }

  public restoreCheckpoint(snapshot: EngineSnapshot): void {
    this.state.logicalTime = snapshot.logicalTime;
    this.state.stateVersion = snapshot.stateVersion;
    this.state.docks = new Map(snapshot.state.docks);
    this.state.stalls = new Map(snapshot.state.stalls);
    this.state.trailers = new Map(snapshot.state.trailers);
    this.state.tractors = new Map(snapshot.state.tractors);
    this.state.equipment = new Map(snapshot.state.equipment);
    this.state.workers = new Map(snapshot.state.workers);
    this.state.shipments = new Map(snapshot.state.shipments);
    this.state.commitments = new Map(snapshot.state.commitments);
    this.eventQueue = snapshot.queue.map((e) => ({ ...e }));
    this.processedRequests = new Map(snapshot.processed);
    this.sequenceCounter = snapshot.sequence;
  }
}
