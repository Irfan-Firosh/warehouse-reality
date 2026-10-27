// Schematic placement for every entity (1 unit = 1 ft). Not surveyed: positions
// only make the S1 counts visible. Pure; no React or three.js.
import {
  DOORS_PER_SIDE,
  HALF_D,
  HALF_L,
  PROXY,
  S1,
  STALLS_NORTH,
  STALLS_SOUTH,
  seeded,
} from "./facility";
import type { Placement, SceneState, Trailer } from "./types";

const DOOR_GAP = 4;
const HITCH_GAP = 1;
const TRAILER_CLEARANCE = 1.5;
/** The drive lane along the south court, between the dock aprons and the yard park. */
export const MOVE_LANE_Z = HALF_D + 70;
/** The gate queue lines up northward on an access road off the west end, facing the south court. */
export const GATE_ROAD = { x: -HALF_L - 90, width: 40 } as const;
export const GATE_FRONT_Z = HALF_D + 40;
export const GATE_SPACING = 80;
export const YARD_PARK = {
  x0: HALF_L - 60,
  z: HALF_D + 120,
  spacing: 30,
} as const;
const STALL_GAP = 2;
const FORKLIFT_TURN = 1.3;
const RAMP_SLOTS: readonly (readonly [number, number])[] = [
  [-HALF_L, -120],
  [-HALF_L, 120],
  [HALF_L, -120],
  [HALF_L, 120],
];

const [TRAILER_W, TRAILER_H, TRAILER_L] = PROXY.trailer;
const [TRACTOR_W, TRACTOR_H, TRACTOR_L] = PROXY.tractor;
const TRAILER_SIZE = [TRAILER_W, TRAILER_H, TRAILER_L] as const;
const TRACTOR_SIZE = [TRACTOR_W, TRACTOR_H, TRACTOR_L] as const;
const TRAILER_Y = TRAILER_H / 2 + TRAILER_CLEARANCE;
const TRACTOR_Y = TRACTOR_H / 2;
/** Centre-to-centre distance from a trailer to the tractor pulling it. */
export const HITCH = TRAILER_L / 2 + TRACTOR_L / 2 + HITCH_GAP;

export interface DoorSlot {
  x: number;
  z: number;
  /** -1 for the north wall, +1 for the south wall (schematic). */
  dir: -1 | 1;
}

export const doorSlot = (index: number): DoorSlot => {
  const north = index < DOORS_PER_SIDE;
  const k = north ? index : index - DOORS_PER_SIDE;
  const x = -HALF_L + (S1.length / (DOORS_PER_SIDE + 1)) * (k + 1);
  return { x, z: north ? -HALF_D : HALF_D, dir: north ? -1 : 1 };
};

export const stallSlot = (
  index: number,
): { x: number; z: number; pitch: number } => {
  const north = index < STALLS_NORTH;
  const count = north ? STALLS_NORTH : STALLS_SOUTH;
  const k = north ? index : index - STALLS_NORTH;
  const pitch = S1.length / count;
  const dir = north ? -1 : 1;
  return {
    x: -HALF_L + pitch * (k + 0.5),
    z: dir * (HALF_D + S1.courtDepth + S1.trailerParkDepth / 2),
    pitch,
  };
};

/** rotY is always the nose heading; models face +z at rotY 0. */
const noseAway = (dir: number): number => (dir > 0 ? 0 : Math.PI);

/** A trailer backed onto door `index`, nose (and tractor) pointing away from the wall. */
export const trailerAtDoor = (index: number): Placement & { dir: -1 | 1 } => {
  const p = doorSlot(index);
  return {
    x: p.x,
    y: TRAILER_Y,
    z: p.z + p.dir * (DOOR_GAP + TRAILER_L / 2),
    rotY: noseAway(p.dir),
    dir: p.dir,
    size: TRAILER_SIZE,
  };
};

/** A moving trailer's `from→to` doors, when both are door ids in `doors`. */
export const doorPair = (
  t: Trailer,
  doors: Pick<ReadonlySet<string>, "has">,
): readonly [string, string] | undefined => {
  if (t.status !== "moving") return undefined;
  const [from, to] = t.at.split("→");
  return from && to && doors.has(from) && doors.has(to)
    ? [from, to]
    : undefined;
};

/** The first moving trailer's `from→to` doors, when both are door ids in this state. */
export const movingPair = (
  state: SceneState,
): readonly [string, string] | undefined => {
  const doors = new Set(state.doors.map((d) => d.id));
  for (const t of state.trailers) {
    const pair = doorPair(t, doors);
    if (pair) return pair;
  }
  return undefined;
};

/** Halfway between two doors on the first door's drive lane, nose toward the second. */
const betweenDoors = (from: number, to: number): Placement => {
  const [a, b] = [doorSlot(from), doorSlot(to)];
  return {
    x: (a.x + b.x) / 2,
    y: TRAILER_Y,
    z: a.dir * MOVE_LANE_Z,
    rotY: b.x >= a.x ? Math.PI / 2 : -Math.PI / 2,
    size: TRAILER_SIZE,
  };
};

const trailerPlacement = (
  t: Trailer,
  doorIndex: ReadonlyMap<string, number>,
  stallIndex: ReadonlyMap<string, number>,
  movingBetween: readonly [number, number],
): Placement => {
  const door = doorIndex.get(t.at);
  if (door !== undefined) return trailerAtDoor(door);
  const stall = stallIndex.get(t.at);
  if (stall !== undefined) {
    const s = stallSlot(stall);
    return {
      x: s.x,
      y: TRAILER_Y,
      z: s.z,
      rotY: noseAway(Math.sign(s.z)),
      size: TRAILER_SIZE,
    };
  }
  if (t.status === "moving") {
    const pair = doorPair(t, doorIndex);
    const [from, to] = pair
      ? pair.map((id) => doorIndex.get(id) ?? 0)
      : movingBetween;
    return betweenDoors(from, to);
  }
  return {
    x: GATE_ROAD.x,
    y: TRAILER_Y,
    z: GATE_FRONT_Z - (t.queueIndex ?? 0) * GATE_SPACING,
    rotY: 0,
    size: TRAILER_SIZE,
  };
};

/** Tractors sit ahead of the trailer they pull, along its nose. */
const tractorPlacement = (
  trailer: Placement | undefined,
  parkIndex: number,
): Placement => {
  if (!trailer) {
    return {
      x: YARD_PARK.x0 - parkIndex * YARD_PARK.spacing,
      y: TRACTOR_Y,
      z: YARD_PARK.z,
      rotY: 0,
      size: TRACTOR_SIZE,
    };
  }
  return {
    x: trailer.x + Math.sin(trailer.rotY) * HITCH,
    y: TRACTOR_Y,
    z: trailer.z + Math.cos(trailer.rotY) * HITCH,
    rotY: trailer.rotY,
    size: TRACTOR_SIZE,
  };
};

export const buildLayout = (
  state: SceneState,
  movingBetween: readonly [string, string],
): ReadonlyMap<string, Placement> => {
  const doorIndex = new Map(state.doors.map((d) => [d.id, d.index]));
  const stallIndex = new Map(state.stalls.map((s) => [s.id, s.index]));
  const indexOfDoor = (id: string): number => {
    const index = doorIndex.get(id);
    if (index === undefined) throw new Error(`unknown door ${id}`);
    return index;
  };
  const moving = [
    indexOfDoor(movingBetween[0]),
    indexOfDoor(movingBetween[1]),
  ] as const;

  const trailers = new Map(
    state.trailers.map((t) => [
      t.id,
      trailerPlacement(t, doorIndex, stallIndex, moving),
    ]),
  );
  const rand = seeded(11);
  const [fw, fh, fl] = PROXY.forklift;
  const entries: [string, Placement][] = [
    ...state.doors.map((d): [string, Placement] => {
      const p = doorSlot(d.index);
      return [
        d.id,
        { x: p.x, y: 7, z: p.z + p.dir * 8, rotY: 0, size: [13, 14, 16] },
      ];
    }),
    ...state.ramps.map((r): [string, Placement] => {
      const [x, z] = RAMP_SLOTS[r.index];
      return [
        r.id,
        {
          x: x + Math.sign(x) * 1.5,
          y: 7,
          z,
          rotY: Math.PI / 2,
          size: [PROXY.ramp[0], PROXY.ramp[1], 3],
        },
      ];
    }),
    ...state.stalls.map((s): [string, Placement] => {
      const slot = stallSlot(s.index);
      return [
        s.id,
        {
          x: slot.x,
          y: 0.6,
          z: slot.z,
          rotY: 0,
          size: [slot.pitch - STALL_GAP, 0.3, S1.trailerParkDepth],
        },
      ];
    }),
    ...[...trailers].map(([id, p]): [string, Placement] => [id, p]),
    ...state.tractors.map((t): [string, Placement] => [
      t.id,
      tractorPlacement(t.at ? trailers.get(t.at) : undefined, t.parkIndex ?? 0),
    ]),
    ...state.forklifts.map((f): [string, Placement] => [
      f.id,
      {
        x: -HALF_L + 60 + rand() * (S1.length - 120),
        y: fh / 2 + 1,
        z: (rand() - 0.5) * (S1.depth - 120),
        rotY: f.index * FORKLIFT_TURN,
        size: [fw, fh, fl],
      },
    ]),
  ];
  return new Map(entries);
};
