/**
 * SYNTHETIC TEST FIXTURES (PRD §4.4, §17).
 * Solely used to verify software invariants; never appears as real facility data.
 */

import type {
  EquipmentEntity,
  ShipmentEntity,
  TractorEntity,
  TrailerEntity,
  WorkerEntity,
} from "./types";

export const SYNTHETIC_TRAILER_1: TrailerEntity = {
  id: "T-SYN-01",
  location: { kind: "dock", dockId: "D-001" },
  cargo: [{ shipmentId: "SH-SYN-01", quantity: 20 }],
  doorOpen: true,
  status: "serving",
};

export const SYNTHETIC_TRAILER_2: TrailerEntity = {
  id: "T-SYN-02",
  location: { kind: "stall", stallId: "P-001" },
  cargo: [{ shipmentId: "SH-SYN-02", quantity: 15 }],
  doorOpen: false,
  status: "parked",
};

export const SYNTHETIC_TRACTOR_1: TractorEntity = {
  id: "TR-SYN-01",
  role: "yard",
  status: "idle",
};

export const SYNTHETIC_FORKLIFT_1: EquipmentEntity = {
  id: "F-SYN-01",
  type: "forklift",
  status: "working",
};

export const SYNTHETIC_WORKER_1: WorkerEntity = {
  id: "W-SYN-01",
  role: "crew",
  status: "available",
};

export const SYNTHETIC_SHIPMENT_1: ShipmentEntity = {
  id: "SH-SYN-01",
  origin: "Supplier A",
  destination: "Bay 4",
  totalQuantity: 20,
  transferredQuantity: 0,
  containerId: "T-SYN-01",
};
