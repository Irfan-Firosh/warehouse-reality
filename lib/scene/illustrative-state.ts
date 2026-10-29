// ILLUSTRATIVE placeholder run state for the 3D scene until the engine exists.
// S1 counts are real; every status, trailer and equipment count here is made up
// and must be labeled as illustrative wherever it is shown.
import { doorId, forkliftId, rampId, S1, seeded, stallId } from "./facility";
import type {
  Door,
  Entity,
  Forklift,
  Ramp,
  SceneState,
  Stall,
  Tractor,
  Trailer,
} from "./types";

export const CLOSED_DOOR = "D-108";
export const TARGET_DOOR = "D-112";
export const MOVING_TRAILER = "T-2291";
const GATE_QUEUE = 4;
const FORKLIFTS = 24;
const YARD_TRACTORS = 6;
const FAILED_FORKLIFT = "F-07";
const BLOCKED_DOORS: ReadonlyMap<string, string> = new Map([
  ["D-027", "T-2027"],
  ["D-074", "T-2074"],
  ["D-153", "T-2153"],
]);
const SERVING_SHARE = 0.33;
const STALL_OCCUPIED_SHARE = 0.55;
const STALL_WAITING_SHARE = 0.07;

const buildDoors = (rand: () => number): Door[] =>
  Array.from({ length: S1.dockDoors }, (_, index): Door => {
    const id = doorId(index);
    const base = { id, kind: "door" as const, index };
    if (id === CLOSED_DOOR)
      return { ...base, status: "closed", note: "14:00–16:00 · hypothetical" };
    if (id === TARGET_DOOR)
      return { ...base, status: "reserved", note: "14:20–15:05" };
    const blockedBy = BLOCKED_DOORS.get(id);
    if (blockedBy) return { ...base, status: "blocked", trailer: blockedBy };
    return rand() < SERVING_SHARE
      ? { ...base, status: "serving", trailer: `T-${2000 + index + 1}` }
      : { ...base, status: "free" };
  });

const buildStalls = (rand: () => number): Stall[] =>
  Array.from({ length: S1.trailerSpaces }, (_, index): Stall => {
    const base = { id: stallId(index), kind: "stall" as const, index };
    return rand() < STALL_OCCUPIED_SHARE
      ? { ...base, trailer: `T-${3000 + index + 1}` }
      : base;
  });

const buildTrailers = (
  doors: readonly Door[],
  stalls: readonly Stall[],
  rand: () => number,
): Trailer[] => [
  ...doors.flatMap((d): Trailer[] =>
    d.trailer
      ? [
          {
            id: d.trailer,
            kind: "trailer",
            status: d.status === "blocked" ? "blocked" : "serving",
            at: d.id,
          },
        ]
      : [],
  ),
  ...stalls.flatMap((s): Trailer[] =>
    s.trailer
      ? [
          {
            id: s.trailer,
            kind: "trailer",
            status: rand() < STALL_WAITING_SHARE ? "waiting" : "parked",
            at: s.id,
          },
        ]
      : [],
  ),
  {
    id: MOVING_TRAILER,
    kind: "trailer",
    status: "moving",
    at: `${CLOSED_DOOR}→${TARGET_DOOR}`,
  },
  ...Array.from(
    { length: GATE_QUEUE },
    (_, k): Trailer => ({
      id: `T-${4101 + k}`,
      kind: "trailer",
      status: "gate",
      at: "gate queue",
      queueIndex: k,
    }),
  ),
];

const buildTractors = (): Tractor[] => [
  ...[...BLOCKED_DOORS.values()].map(
    (trailer, k): Tractor => ({
      id: `TR-${301 + k}`,
      kind: "tractor",
      role: "road",
      status: "coupled",
      at: trailer,
    }),
  ),
  ...Array.from(
    { length: GATE_QUEUE },
    (_, k): Tractor => ({
      id: `TR-${411 + k}`,
      kind: "tractor",
      role: "road",
      status: "coupled",
      at: `T-${4101 + k}`,
    }),
  ),
  ...Array.from(
    { length: YARD_TRACTORS },
    (_, k): Tractor =>
      k === 1
        ? {
            id: "YT-2",
            kind: "tractor",
            role: "yard",
            status: "moving",
            at: MOVING_TRAILER,
          }
        : {
            id: `YT-${k + 1}`,
            kind: "tractor",
            role: "yard",
            status: "idle",
            parkIndex: k,
          },
  ),
];

const buildRamps = (): Ramp[] =>
  Array.from(
    { length: S1.rampDoors },
    (_, index): Ramp => ({
      id: rampId(index),
      kind: "ramp",
      index,
      status: "free",
    }),
  );

const buildForklifts = (): Forklift[] =>
  Array.from({ length: FORKLIFTS }, (_, index): Forklift => {
    const id = forkliftId(index);
    const base = { id, kind: "forklift" as const, index };
    return id === FAILED_FORKLIFT
      ? { ...base, status: "failed", note: "13:52 · hypothetical" }
      : { ...base, status: "working" };
  });

const buildState = (): SceneState => {
  const rand = seeded(47);
  const doors = buildDoors(rand);
  const stalls = buildStalls(rand);
  return {
    doors,
    ramps: buildRamps(),
    stalls,
    trailers: buildTrailers(doors, stalls, rand),
    tractors: buildTractors(),
    forklifts: buildForklifts(),
  };
};

export const ILLUSTRATIVE_STATE: SceneState = buildState();

export const entitiesById = (state: SceneState): ReadonlyMap<string, Entity> =>
  new Map(
    [
      ...state.doors,
      ...state.ramps,
      ...state.stalls,
      ...state.trailers,
      ...state.tractors,
      ...state.forklifts,
    ].map((e) => [e.id, e]),
  );
