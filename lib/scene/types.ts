export type DoorStatus = "serving" | "blocked" | "closed" | "reserved" | "free";
export type TrailerStatus =
  | "serving"
  | "blocked"
  | "waiting"
  | "parked"
  | "moving"
  | "gate";

export interface Door {
  id: string;
  kind: "door";
  index: number;
  status: DoorStatus;
  trailer?: string;
}
export interface Ramp {
  id: string;
  kind: "ramp";
  index: number;
  status: "free";
}
export interface Stall {
  id: string;
  kind: "stall";
  index: number;
  trailer?: string;
}
export interface Trailer {
  id: string;
  kind: "trailer";
  status: TrailerStatus;
  at: string;
  queueIndex?: number;
}
export interface Tractor {
  id: string;
  kind: "tractor";
  role: "road" | "yard";
  status: "coupled" | "moving" | "idle";
  at?: string;
  parkIndex?: number;
}
export interface Forklift {
  id: string;
  kind: "forklift";
  index: number;
  status: "working" | "failed";
}

export type Entity = Door | Ramp | Stall | Trailer | Tractor | Forklift;
export type EntityKind = Entity["kind"];

export interface SceneState {
  doors: readonly Door[];
  ramps: readonly Ramp[];
  stalls: readonly Stall[];
  trailers: readonly Trailer[];
  tractors: readonly Tractor[];
  forklifts: readonly Forklift[];
}

/** Center position, yaw and box size [width, height, length] in ft. */
export interface Placement {
  x: number;
  y: number;
  z: number;
  rotY: number;
  size: readonly [number, number, number];
}
