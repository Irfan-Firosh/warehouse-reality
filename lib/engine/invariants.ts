/**
 * Hard Physical Invariant Verifications (PRD §11.2, §18 P01–P05).
 * Validations run before any state transition.
 */

import type {
  EngineState,
  EntityId,
  PhysicalLocation,
  ResourceReservation,
} from "./types";

export type InvariantResult =
  | { ok: true }
  | {
      ok: false;
      violation: string;
      reasonCode: "INVARIANT_VIOLATION" | "RESOURCE_UNAVAILABLE";
    };

/**
 * P01: A trailer resides in at most one physical location.
 */
export const checkTrailerSingleLocation = (
  trailerId: EntityId,
  targetLocation: PhysicalLocation,
  state: EngineState,
): InvariantResult => {
  const trailer = state.trailers.get(trailerId);
  if (!trailer) {
    return {
      ok: false,
      violation: `Trailer ${trailerId} does not exist.`,
      reasonCode: "INVARIANT_VIOLATION",
    };
  }

  // If targeting a dock, check if another trailer is already there
  if (targetLocation.kind === "dock") {
    const dock = state.docks.get(targetLocation.dockId);
    if (!dock) {
      return {
        ok: false,
        violation: `Dock ${targetLocation.dockId} does not exist.`,
        reasonCode: "INVARIANT_VIOLATION",
      };
    }
    if (dock.occupiedTrailerId && dock.occupiedTrailerId !== trailerId) {
      return {
        ok: false,
        violation: `Dock ${targetLocation.dockId} is already occupied by trailer ${dock.occupiedTrailerId} (P03 violation).`,
        reasonCode: "RESOURCE_UNAVAILABLE",
      };
    }
    if (dock.status === "closed") {
      return {
        ok: false,
        violation: `Dock ${targetLocation.dockId} is closed (P03 violation).`,
        reasonCode: "RESOURCE_UNAVAILABLE",
      };
    }
  }

  // If targeting a stall, check if another trailer is already there
  if (targetLocation.kind === "stall") {
    const stall = state.stalls.get(targetLocation.stallId);
    if (!stall) {
      return {
        ok: false,
        violation: `Stall ${targetLocation.stallId} does not exist.`,
        reasonCode: "INVARIANT_VIOLATION",
      };
    }
    if (stall.occupiedTrailerId && stall.occupiedTrailerId !== trailerId) {
      return {
        ok: false,
        violation: `Stall ${targetLocation.stallId} is already occupied by trailer ${stall.occupiedTrailerId} (P01 violation).`,
        reasonCode: "RESOURCE_UNAVAILABLE",
      };
    }
  }

  return { ok: true };
};

/**
 * P01: A tractor couples to at most one trailer at a time.
 */
export const checkTractorCoupling = (
  tractorId: EntityId,
  trailerId: EntityId,
  state: EngineState,
): InvariantResult => {
  const tractor = state.tractors.get(tractorId);
  if (!tractor) {
    return {
      ok: false,
      violation: `Tractor ${tractorId} does not exist.`,
      reasonCode: "INVARIANT_VIOLATION",
    };
  }
  if (tractor.coupledTrailerId && tractor.coupledTrailerId !== trailerId) {
    return {
      ok: false,
      violation: `Tractor ${tractorId} is already coupled to trailer ${tractor.coupledTrailerId} (P01 violation).`,
      reasonCode: "INVARIANT_VIOLATION",
    };
  }

  const trailer = state.trailers.get(trailerId);
  if (!trailer) {
    return {
      ok: false,
      violation: `Trailer ${trailerId} does not exist.`,
      reasonCode: "INVARIANT_VIOLATION",
    };
  }

  // Check if trailer is already coupled to a different tractor
  for (const [otherTractorId, otherTractor] of state.tractors.entries()) {
    if (
      otherTractorId !== tractorId &&
      otherTractor.coupledTrailerId === trailerId
    ) {
      return {
        ok: false,
        violation: `Trailer ${trailerId} is already coupled to tractor ${otherTractorId} (P01 violation).`,
        reasonCode: "INVARIANT_VIOLATION",
      };
    }
  }

  return { ok: true };
};

/**
 * P04: Worker or handling equipment cannot serve overlapping tasks.
 * P03: Unavailable docks/equipment cannot accept new work.
 */
export const checkReservationAvailability = (
  res: ResourceReservation,
  state: EngineState,
  excludingCommitmentId?: EntityId,
): InvariantResult => {
  switch (res.type) {
    case "dock": {
      const dock = state.docks.get(res.resourceId);
      if (!dock) {
        return {
          ok: false,
          violation: `Dock ${res.resourceId} does not exist.`,
          reasonCode: "INVARIANT_VIOLATION",
        };
      }
      if (dock.status === "closed") {
        return {
          ok: false,
          violation: `Dock ${res.resourceId} is closed due to disruption (P03 violation).`,
          reasonCode: "RESOURCE_UNAVAILABLE",
        };
      }
      if (
        dock.reservedCommitmentId &&
        dock.reservedCommitmentId !== excludingCommitmentId
      ) {
        return {
          ok: false,
          violation: `Dock ${res.resourceId} is already reserved by commitment ${dock.reservedCommitmentId}.`,
          reasonCode: "RESOURCE_UNAVAILABLE",
        };
      }
      break;
    }

    case "equipment": {
      const eq = state.equipment.get(res.resourceId);
      if (!eq) {
        return {
          ok: false,
          violation: `Equipment ${res.resourceId} does not exist.`,
          reasonCode: "INVARIANT_VIOLATION",
        };
      }
      if (eq.status === "failed") {
        return {
          ok: false,
          violation: `Equipment ${res.resourceId} is failed and unavailable (P03 violation).`,
          reasonCode: "RESOURCE_UNAVAILABLE",
        };
      }
      if (
        eq.assignedCommitmentId &&
        eq.assignedCommitmentId !== excludingCommitmentId
      ) {
        return {
          ok: false,
          violation: `Equipment ${res.resourceId} is already assigned to commitment ${eq.assignedCommitmentId} (P04 violation).`,
          reasonCode: "RESOURCE_UNAVAILABLE",
        };
      }
      break;
    }

    case "worker": {
      const worker = state.workers.get(res.resourceId);
      if (!worker) {
        return {
          ok: false,
          violation: `Worker ${res.resourceId} does not exist.`,
          reasonCode: "INVARIANT_VIOLATION",
        };
      }
      if (worker.status === "absent") {
        return {
          ok: false,
          violation: `Worker ${res.resourceId} is absent.`,
          reasonCode: "RESOURCE_UNAVAILABLE",
        };
      }
      if (
        worker.assignedCommitmentId &&
        worker.assignedCommitmentId !== excludingCommitmentId
      ) {
        return {
          ok: false,
          violation: `Worker ${res.resourceId} is already assigned to commitment ${worker.assignedCommitmentId} (P04 violation).`,
          reasonCode: "RESOURCE_UNAVAILABLE",
        };
      }
      break;
    }

    case "trailer": {
      const trailer = state.trailers.get(res.resourceId);
      if (!trailer) {
        return {
          ok: false,
          violation: `Trailer ${res.resourceId} does not exist.`,
          reasonCode: "INVARIANT_VIOLATION",
        };
      }
      if (
        trailer.assignedCommitmentId &&
        trailer.assignedCommitmentId !== excludingCommitmentId
      ) {
        return {
          ok: false,
          violation: `Trailer ${res.resourceId} is already committed to ${trailer.assignedCommitmentId}.`,
          reasonCode: "RESOURCE_UNAVAILABLE",
        };
      }
      break;
    }

    case "tractor": {
      const tractor = state.tractors.get(res.resourceId);
      if (!tractor) {
        return {
          ok: false,
          violation: `Tractor ${res.resourceId} does not exist.`,
          reasonCode: "INVARIANT_VIOLATION",
        };
      }
      if (
        tractor.assignedCommitmentId &&
        tractor.assignedCommitmentId !== excludingCommitmentId
      ) {
        return {
          ok: false,
          violation: `Tractor ${res.resourceId} is already committed to ${tractor.assignedCommitmentId}.`,
          reasonCode: "RESOURCE_UNAVAILABLE",
        };
      }
      break;
    }

    case "stall": {
      const stall = state.stalls.get(res.resourceId);
      if (!stall) {
        return {
          ok: false,
          violation: `Stall ${res.resourceId} does not exist.`,
          reasonCode: "INVARIANT_VIOLATION",
        };
      }
      if (
        stall.reservedCommitmentId &&
        stall.reservedCommitmentId !== excludingCommitmentId
      ) {
        return {
          ok: false,
          violation: `Stall ${res.resourceId} is already reserved by ${stall.reservedCommitmentId}.`,
          reasonCode: "RESOURCE_UNAVAILABLE",
        };
      }
      break;
    }
  }

  return { ok: true };
};

/**
 * P02: Cargo transfers strictly conserve quantities.
 * Cannot transfer more cargo than currently exists on board.
 */
export const checkCargoTransferConservation = (
  trailerId: EntityId,
  shipmentId: EntityId,
  quantityToUnload: number,
  state: EngineState,
): InvariantResult => {
  const trailer = state.trailers.get(trailerId);
  if (!trailer) {
    return {
      ok: false,
      violation: `Trailer ${trailerId} does not exist.`,
      reasonCode: "INVARIANT_VIOLATION",
    };
  }

  const cargo = trailer.cargo.find((c) => c.shipmentId === shipmentId);
  if (!cargo || cargo.quantity < quantityToUnload) {
    const onBoard = cargo ? cargo.quantity : 0;
    return {
      ok: false,
      violation: `Cannot unload ${quantityToUnload} pallets: only ${onBoard} pallets of shipment ${shipmentId} on trailer ${trailerId} (P02 cargo conservation violation).`,
      reasonCode: "INVARIANT_VIOLATION",
    };
  }

  return { ok: true };
};
