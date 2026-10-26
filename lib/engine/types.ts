/**
 * Canonical Information Model for the Warehouse Simulation Engine (PRD §7, §9, §10).
 * Pure TypeScript; no React or rendering dependencies.
 */

export type EntityId = string;

export type PhysicalLocation =
  | { kind: "dock"; dockId: EntityId }
  | { kind: "stall"; stallId: EntityId }
  | { kind: "coupled"; tractorId: EntityId }
  | { kind: "gate"; queueIndex: number }
  | { kind: "yard_lane"; laneId: string }
  | { kind: "in_transit"; from: string; to: string };

export interface CargoItem {
  shipmentId: EntityId;
  quantity: number; // pallet count
}

export interface TrailerEntity {
  id: EntityId;
  location: PhysicalLocation;
  cargo: CargoItem[];
  doorOpen: boolean;
  status: "parked" | "serving" | "waiting" | "moving" | "blocked" | "gate";
  assignedCommitmentId?: EntityId;
}

export interface TractorEntity {
  id: EntityId;
  role: "road" | "yard";
  coupledTrailerId?: EntityId;
  status: "idle" | "moving" | "servicing";
  currentTask?: string;
  assignedCommitmentId?: EntityId;
}

export interface DockEntity {
  id: EntityId;
  kind: "dock" | "ramp";
  status: "free" | "occupied" | "closed" | "reserved";
  occupiedTrailerId?: EntityId;
  reservedCommitmentId?: EntityId;
}

export interface StallEntity {
  id: EntityId;
  occupiedTrailerId?: EntityId;
  reservedCommitmentId?: EntityId;
}

export interface EquipmentEntity {
  id: EntityId;
  type: "forklift" | "yard_tractor";
  status: "working" | "failed" | "idle";
  assignedCommitmentId?: EntityId;
}

export interface WorkerEntity {
  id: EntityId;
  role: "crew" | "maintenance";
  status: "available" | "assigned" | "absent";
  assignedCommitmentId?: EntityId;
}

export interface ShipmentEntity {
  id: EntityId;
  origin: string;
  destination: string;
  totalQuantity: number;
  transferredQuantity: number;
  containerId: EntityId;
}

export type CommitmentStatus =
  | "proposed"
  | "partially_accepted"
  | "ready_for_validation"
  | "committed"
  | "executing"
  | "completed"
  | "cancelled"
  | "rejected"
  | "expired";

export interface ResourceReservation {
  resourceId: EntityId;
  type: "dock" | "stall" | "equipment" | "worker" | "trailer" | "tractor";
  startWindow: number; // logical time seconds
  endWindow: number; // logical time seconds
}

export interface CommitmentParticipant {
  agentId: EntityId;
  role: string;
  accepted: boolean;
  acceptedAtVersion?: number;
}

export interface CommitmentEntity {
  id: EntityId;
  task: string;
  status: CommitmentStatus;
  participants: CommitmentParticipant[];
  requiredResources: ResourceReservation[];
  createdAt: number;
  expiresAt: number;
  committedAt?: number;
  completedAt?: number;
  stateVersion: number;
  rejectionReason?: string;
}

export interface EngineEvent {
  id: EntityId;
  logicalTime: number; // seconds from shift start (e.g. 50850 = 14:07:30)
  sequence: number;
  type: string;
  affectedIds: EntityId[];
  payload?: Record<string, unknown>;
  causationId?: EntityId;
  stateVersion: number;
}

export type ReasonCode =
  | "STALE_VERSION"
  | "RESOURCE_UNAVAILABLE"
  | "INVARIANT_VIOLATION"
  | "OFFER_EXPIRED"
  | "DUPLICATE_REQUEST"
  | "PARTICIPANTS_INCOMPLETE"
  | "NOT_FOUND";

export interface ToolResult {
  success: boolean;
  reasonCode?: ReasonCode;
  message?: string;
  affectedIds: EntityId[];
  stateVersion: number;
  eventIds: EntityId[];
}

export interface EngineState {
  logicalTime: number;
  stateVersion: number;
  docks: Map<EntityId, DockEntity>;
  stalls: Map<EntityId, StallEntity>;
  trailers: Map<EntityId, TrailerEntity>;
  tractors: Map<EntityId, TractorEntity>;
  equipment: Map<EntityId, EquipmentEntity>;
  workers: Map<EntityId, WorkerEntity>;
  shipments: Map<EntityId, ShipmentEntity>;
  commitments: Map<EntityId, CommitmentEntity>;
}

export interface EngineSnapshot {
  logicalTime: number;
  stateVersion: number;
  eventCount: number;
  state: {
    docks: [EntityId, DockEntity][];
    stalls: [EntityId, StallEntity][];
    trailers: [EntityId, TrailerEntity][];
    tractors: [EntityId, TractorEntity][];
    equipment: [EntityId, EquipmentEntity][];
    workers: [EntityId, WorkerEntity][];
    shipments: [EntityId, ShipmentEntity][];
    commitments: [EntityId, CommitmentEntity][];
  };
}
