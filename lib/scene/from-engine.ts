// The scene's view of an engine snapshot: the S1 identities (182 doors, 4 ramps,
// 235 trailer spaces) always exist, and the engine's statuses are laid over
// them. Read-only; rendering never feeds back into the engine. Pure.
import type {
  DockEntity,
  EngineSnapshot,
  PhysicalLocation,
  TrailerEntity,
} from "@/lib/engine/types";
import { doorId, rampId, S1, stallId } from "./facility";
import type {
  Door,
  DoorStatus,
  Forklift,
  Ramp,
  SceneState,
  Stall,
  Tractor,
  Trailer,
  TrailerStatus,
} from "./types";

const DOOR_STATUS: Readonly<Record<DockEntity["status"], DoorStatus>> = {
  free: "free",
  occupied: "serving",
  closed: "closed",
  reserved: "reserved",
};

// The engine does not update trailer.status on moves, so the scene status
// follows the location and keeps only the engine statuses valid there.
const atDoorStatus = (s: TrailerEntity["status"]): TrailerStatus =>
  s === "blocked" ? "blocked" : "serving";
const inStallStatus = (s: TrailerEntity["status"]): TrailerStatus =>
  s === "waiting" ? "waiting" : "parked";

/**
 * Where a trailer sits in scene terms, or undefined when the scene has no spot
 * for it (coupled, on a yard lane, in transit off the doors, or at an id the
 * S1 layout does not have). Those trailers are left out rather than drawn at a
 * guessed position.
 */
const placeTrailer = (
  t: TrailerEntity,
  loc: PhysicalLocation,
  doors: ReadonlySet<string>,
  stalls: ReadonlySet<string>,
): Trailer | undefined => {
  const base = { id: t.id, kind: "trailer" as const };
  switch (loc.kind) {
    case "dock":
      return doors.has(loc.dockId)
        ? { ...base, status: atDoorStatus(t.status), at: loc.dockId }
        : undefined;
    case "stall":
      return stalls.has(loc.stallId)
        ? { ...base, status: inStallStatus(t.status), at: loc.stallId }
        : undefined;
    case "in_transit":
      return doors.has(loc.from) && doors.has(loc.to)
        ? { ...base, status: "moving", at: `${loc.from}→${loc.to}` }
        : undefined;
    case "gate":
      return {
        ...base,
        status: "gate",
        at: "gate queue",
        queueIndex: loc.queueIndex,
      };
    default:
      return undefined;
  }
};

export const sceneStateFromEngine = (s: EngineSnapshot): SceneState => {
  const docks = new Map(s.state.docks);
  const engineStalls = new Map(s.state.stalls);

  const doors = Array.from({ length: S1.dockDoors }, (_, index): Door => {
    const id = doorId(index);
    const dock = docks.get(id);
    const trailer = dock?.occupiedTrailerId;
    return {
      id,
      kind: "door",
      index,
      status: dock ? DOOR_STATUS[dock.status] : "free",
      ...(trailer ? { trailer } : {}),
    };
  });
  const stalls = Array.from({ length: S1.trailerSpaces }, (_, index): Stall => {
    const id = stallId(index);
    const trailer = engineStalls.get(id)?.occupiedTrailerId;
    return { id, kind: "stall", index, ...(trailer ? { trailer } : {}) };
  });

  const doorIds = new Set(doors.map((d) => d.id));
  const stallIds = new Set(stalls.map((st) => st.id));
  const trailers = s.state.trailers.flatMap(([, t]) => {
    const placed = placeTrailer(t, t.location, doorIds, stallIds);
    return placed ? [placed] : [];
  });
  const shown = new Set(trailers.map((t) => t.id));

  const coupled = (trailer: string | undefined): trailer is string =>
    trailer !== undefined && shown.has(trailer);
  // Yard tractors park first, each role in id order.
  const parked = s.state.tractors
    .filter(([, tr]) => !coupled(tr.coupledTrailerId))
    .map(([, tr]) => tr)
    .sort(
      (a, b) =>
        Number(a.role !== "yard") - Number(b.role !== "yard") ||
        a.id.localeCompare(b.id),
    )
    .map((tr) => tr.id);
  const tractors = s.state.tractors.map(([, tr]): Tractor => {
    const base = { id: tr.id, kind: "tractor" as const, role: tr.role };
    const trailer = tr.coupledTrailerId;
    if (coupled(trailer)) {
      return {
        ...base,
        status: tr.status === "moving" ? "moving" : "coupled",
        at: trailer,
      };
    }
    return {
      ...base,
      status: tr.status === "moving" ? "moving" : "idle",
      parkIndex: parked.indexOf(tr.id),
    };
  });

  const forklifts = s.state.equipment
    .filter(([, e]) => e.type === "forklift")
    .map(
      ([, e], index): Forklift => ({
        id: e.id,
        kind: "forklift",
        index,
        status: e.status,
      }),
    );

  return {
    doors,
    ramps: Array.from({ length: S1.rampDoors }, (_, index): Ramp => {
      const id = rampId(index);
      const ramp = docks.get(id);
      return {
        id,
        kind: "ramp",
        index,
        status: ramp ? DOOR_STATUS[ramp.status] : "free",
      };
    }),
    stalls,
    trailers,
    tractors,
    forklifts,
  };
};

/**
 * The previous scene state when the new one has the same content, so a run
 * update that moved nothing keeps the layout, motion and live poses as they are.
 */
export const keepSameScene = (
  prev: SceneState | undefined,
  next: SceneState,
): SceneState =>
  prev !== undefined && JSON.stringify(prev) === JSON.stringify(next)
    ? prev
    : next;
