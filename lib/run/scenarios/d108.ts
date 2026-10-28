/**
 * D-108 scenario seed. Every value here is a scenario value chosen for the
 * rehearsal, not a claim about the DFW facility.
 */

import type { SimulationEngine } from "../../engine/engine";

export const D108 = {
  closedDock: "D-108",
  targetDock: "D-112",
  trailer: "T-2291",
  shipment: "SH-5512",
  contender: "T-3061",
} as const;

const TOTAL_PALLETS = 22;
const TRANSFERRED_PALLETS = 9;
const CONTENDER_STALL = "P-061";

export const seedD108 = (engine: SimulationEngine): void => {
  engine.addShipment({
    id: D108.shipment,
    origin: "unspecified (scenario)",
    destination: "unspecified (scenario)",
    totalQuantity: TOTAL_PALLETS,
    transferredQuantity: TRANSFERRED_PALLETS,
    containerId: D108.trailer,
  });
  engine.addTrailer({
    id: D108.trailer,
    location: { kind: "dock", dockId: D108.closedDock },
    cargo: [
      {
        shipmentId: D108.shipment,
        quantity: TOTAL_PALLETS - TRANSFERRED_PALLETS,
      },
    ],
    doorOpen: true,
    status: "serving",
  });
  engine.addTrailer({
    id: D108.contender,
    location: { kind: "stall", stallId: CONTENDER_STALL },
    cargo: [],
    doorOpen: false,
    status: "waiting",
  });
  engine.addTractor({ id: "YT-2", role: "yard", status: "idle" });
  engine.addEquipment({ id: "F-07", type: "forklift", status: "working" });

  engine.emitEvent({
    id: "E-SCENARIO-D108-SEEDED",
    logicalTime: engine.getLogicalTime(),
    type: "scenario_seeded",
    affectedIds: [
      D108.closedDock,
      D108.targetDock,
      D108.trailer,
      D108.shipment,
      D108.contender,
      CONTENDER_STALL,
      "YT-2",
      "F-07",
    ],
    payload: { scenario: "D-108", provenance: "scenario" },
    stateVersion: engine.getStateVersion(),
  });
};
