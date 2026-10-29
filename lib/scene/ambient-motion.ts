// ILLUSTRATIVE ambient motion: decorative movement so the miniature reads as
// alive. Deterministic from a display clock and the entity id; never written
// to the engine, and no speed or duration here is a facility number.
// Pure; no React or three.js.
import { HALF_L, seeded } from "./facility";
import {
  doorPair,
  GATE_FRONT_Z,
  GATE_SPACING,
  HITCH,
  MOVE_LANE_Z,
  trailerAtDoor,
  YARD_PARK,
} from "./layout";
import type { Placement, SceneState, Tractor, Trailer } from "./types";

export type Point = readonly [number, number];

export type DisplaySpeed = 1 | 4 | 16;

export interface AmbientMotion {
  /** Every entity this module moves; everything else keeps its layout pose. */
  ids: ReadonlySet<string>;
  poseAt: (id: string, t: number) => Placement | undefined;
  /** The ground path an entity travels, for drawing; undefined for loops and static entities. */
  route: (id: string) => readonly Point[] | undefined;
}

/** Steps per wall-clock second when time-lapsed, for the wind-up-toy stutter. */
const STEP_HZ = 8;

/**
 * Display time as the scene shows it: smooth at 1×, otherwise held between
 * 8 Hz wall-clock steps (each step spans `speed / 8` display seconds).
 */
export const quantize = (t: number, speed: DisplaySpeed): number => {
  if (speed === 1) return t;
  const step = speed / STEP_HZ;
  return Math.floor(t / step) * step;
};

// Visual pacing only, in display ft/s and s.
export const TRUCK_PACE = 15;
const FORKLIFT_PACE = 6;
const MOVE_HOLD = 6;
const SHUTTLE_HOLD = 20;
const GATE_CYCLE = 12;
/** The shuttle drive runs between the move lane and the yard park. */
const SHUTTLE_Z = YARD_PARK.z - 25;
const SHUTTLE_REACH = [200, 600] as const;
const FORKLIFT_RADIUS = [12, 30] as const;
/** Travel over which the heading turns at a route corner, so nothing snaps. */
const TURN_BLEND = 30;
/** Cross-wall moves go around the west end, between the wall and the gate road. */
const END_LANE_X = -HALF_L - 45;

/** Heading (rotY) of travel along (dx, dz); the models face +z at rotY 0. */
const headingOf = (dx: number, dz: number): number => Math.atan2(dx, dz);

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

const mod = (a: number, n: number): number => ((a % n) + n) % n;

const smoothstep = (x: number): number => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

/** A stable number in [0, 1) per id, so each entity has its own phase. */
const idPhase = (id: string, salt: number): number => {
  let h = salt;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
  return seeded(h)();
};

interface Track {
  points: readonly Point[];
  /** Cumulative length at each point. */
  at: readonly number[];
  total: number;
  /** Nose heading on each leg. */
  headings: readonly number[];
}

/** `reverseLast`: the last leg is a reverse (onto a door), so the nose faces back along it. */
const trackOf = (points: readonly Point[], reverseLast = false): Track => {
  const legs = points
    .slice(1)
    .map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  const at = [0, ...legs.map((_, i) => sum(legs.slice(0, i + 1)))];
  const headings = points.slice(1).map((p, i) => {
    const h = headingOf(p[0] - points[i][0], p[1] - points[i][1]);
    return reverseLast && i === legs.length - 1 ? h + Math.PI : h;
  });
  return { points, at, total: at[at.length - 1], headings };
};

/** `from` turned toward `to` by fraction `f`, the short way round. */
const turn = (from: number, to: number, f: number): number =>
  from + (mod(to - from + Math.PI, 2 * Math.PI) - Math.PI) * f;

/** Half the blend at the corner after leg `i`, capped so blends never overlap. */
const blendHalf = (track: Track, i: number): number =>
  Math.min(
    TURN_BLEND / 2,
    (track.at[i + 1] - track.at[i]) / 2,
    (track.at[i + 2] - track.at[i + 1]) / 2,
  );

/** The nose heading on leg `i` at distance `dist`, eased through corners. */
const headingAt = (track: Track, i: number, dist: number): number => {
  const { at, headings } = track;
  if (i + 1 < headings.length) {
    const half = blendHalf(track, i);
    const left = at[i + 1] - dist;
    if (half > 0 && left < half)
      return turn(headings[i], headings[i + 1], (half - left) / (2 * half));
  }
  if (i > 0) {
    const half = blendHalf(track, i - 1);
    const done = dist - at[i];
    if (half > 0 && done < half)
      return turn(headings[i - 1], headings[i], (half + done) / (2 * half));
  }
  return headings[i];
};

interface TrackPoint {
  x: number;
  z: number;
  /** Nose heading at this point. */
  heading: number;
}

const along = (track: Track, d: number): TrackPoint => {
  const { points, at } = track;
  const dist = Math.min(Math.max(d, 0), track.total);
  let i = 1;
  while (i < points.length - 1 && at[i] < dist) i++;
  const [ax, az] = points[i - 1];
  const [bx, bz] = points[i];
  const span = at[i] - at[i - 1];
  const f = span > 0 ? (dist - at[i - 1]) / span : 0;
  return {
    x: ax + (bx - ax) * f,
    z: az + (bz - az) * f,
    heading: headingAt(track, i - 1, dist),
  };
};

/** Distance along a track that is driven once, then held, then repeated. */
const loopOnce = (track: Track, t: number, phase: number): number => {
  const drive = track.total / TRUCK_PACE;
  return Math.min(
    mod(t + phase * (drive + MOVE_HOLD), drive + MOVE_HOLD) * TRUCK_PACE,
    track.total,
  );
};

/** Out, hold, back, hold: returns distance and whether it is on the way back. */
const pingPong = (
  track: Track,
  t: number,
  phase: number,
): { d: number; back: boolean } => {
  const drive = track.total / TRUCK_PACE;
  const cycle = 2 * (drive + SHUTTLE_HOLD);
  const c = mod(t + phase * cycle, cycle);
  if (c < SHUTTLE_HOLD) return { d: 0, back: false };
  if (c < SHUTTLE_HOLD + drive)
    return { d: (c - SHUTTLE_HOLD) * TRUCK_PACE, back: false };
  if (c < 2 * SHUTTLE_HOLD + drive) return { d: track.total, back: true };
  return {
    d: track.total - (c - 2 * SHUTTLE_HOLD - drive) * TRUCK_PACE,
    back: true,
  };
};

const withXZ = (
  base: Placement,
  x: number,
  z: number,
  rotY: number,
): Placement => ({ ...base, x, z, rotY });

/** A tractor hitched ahead of its trailer, along the trailer's nose direction. */
const hitched = (tractor: Placement, trailer: Placement): Placement =>
  withXZ(
    tractor,
    trailer.x + Math.sin(trailer.rotY) * HITCH,
    trailer.z + Math.cos(trailer.rotY) * HITCH,
    trailer.rotY,
  );

type Animator = (t: number) => Placement;

/**
 * A trailer pulls off door A, runs its wall's move lane (around the west end
 * when B is on the other wall), and backs onto door B.
 */
const moveRoute = (from: number, to: number): Point[] => {
  const [a, b] = [trailerAtDoor(from), trailerAtDoor(to)];
  const [laneA, laneB] = [a.dir * MOVE_LANE_Z, b.dir * MOVE_LANE_Z];
  const around: Point[] =
    a.dir === b.dir
      ? []
      : [
          [END_LANE_X, laneA],
          [END_LANE_X, laneB],
        ];
  return [[a.x, a.z], [a.x, laneA], ...around, [b.x, laneB], [b.x, b.z]];
};

const gateQueue = (state: SceneState): Trailer[] =>
  state.trailers
    .filter((t) => t.at === "gate queue")
    .sort((p, q) => (p.queueIndex ?? 0) - (q.queueIndex ?? 0));

/**
 * The gate queue as a stop-and-go conveyor: at rest the trailers hold slots
 * 0..n-1; each cycle they creep one spacing toward the gate, the front one
 * pulls through (slot -1) and reappears at the back. A queue of one holds.
 */
const gateSlot = (k: number, n: number, t: number): number => {
  if (n < 2) return k;
  const c = t / GATE_CYCLE;
  const creep = smoothstep((c - Math.floor(c) - 0.5) * 2);
  return mod(k - Math.floor(c), n) - creep;
};

export const createAmbientMotion = (
  state: SceneState,
  layout: ReadonlyMap<string, Placement>,
): AmbientMotion => {
  const animators = new Map<string, Animator>();
  const routes = new Map<string, readonly Point[]>();
  const towing = new Map<string, Tractor>(
    state.tractors.flatMap((tr): [string, Tractor][] =>
      tr.at && tr.status !== "idle" ? [[tr.at, tr]] : [],
    ),
  );

  const tow = (trailerId: string, trailerAt: Animator) => {
    const tractor = towing.get(trailerId);
    const rest = tractor && layout.get(tractor.id);
    if (!tractor || !rest) return;
    animators.set(tractor.id, (t) => hitched(rest, trailerAt(t)));
    const route = routes.get(trailerId);
    if (route) routes.set(tractor.id, route);
  };

  const doorIndex = new Map(state.doors.map((d) => [d.id, d.index]));
  for (const tr of state.trailers) {
    const pair = doorPair(tr, doorIndex);
    const rest = layout.get(tr.id);
    if (!pair || !rest) continue;
    const route = moveRoute(
      doorIndex.get(pair[0]) ?? 0,
      doorIndex.get(pair[1]) ?? 0,
    );
    const track = trackOf(route, true);
    const at: Animator = (t) => {
      const p = along(track, loopOnce(track, t, idPhase(tr.id, 1)));
      return withXZ(rest, p.x, p.z, p.heading);
    };
    animators.set(tr.id, at);
    routes.set(tr.id, route);
    tow(tr.id, at);
  }

  const queue = gateQueue(state);
  for (const [k, tr] of queue.entries()) {
    const rest = layout.get(tr.id);
    if (!rest) continue;
    const at: Animator = (t) =>
      withXZ(
        rest,
        rest.x,
        GATE_FRONT_Z - gateSlot(k, queue.length, t) * GATE_SPACING,
        0,
      );
    animators.set(tr.id, at);
    routes.set(tr.id, [
      [rest.x, GATE_FRONT_Z - (queue.length - 1) * GATE_SPACING],
      [rest.x, GATE_FRONT_Z + GATE_SPACING],
    ]);
    tow(tr.id, at);
  }

  for (const tr of state.tractors) {
    if (tr.role !== "yard" || tr.status !== "idle") continue;
    const rest = layout.get(tr.id);
    if (!rest) continue;
    const reach =
      SHUTTLE_REACH[0] +
      idPhase(tr.id, 2) * (SHUTTLE_REACH[1] - SHUTTLE_REACH[0]);
    const path: Point[] = [
      [rest.x, rest.z],
      [rest.x, SHUTTLE_Z],
      [rest.x - reach, SHUTTLE_Z],
    ];
    const track = trackOf(path);
    animators.set(tr.id, (t) => {
      const { d, back } = pingPong(track, t, idPhase(tr.id, 3));
      if (d <= 0) return rest;
      const p = along(track, d);
      return withXZ(rest, p.x, p.z, back ? p.heading + Math.PI : p.heading);
    });
    routes.set(tr.id, path);
  }

  for (const f of state.forklifts) {
    if (f.status !== "working") continue;
    const rest = layout.get(f.id);
    if (!rest) continue;
    const r =
      FORKLIFT_RADIUS[0] +
      idPhase(f.id, 4) * (FORKLIFT_RADIUS[1] - FORKLIFT_RADIUS[0]);
    const spin = idPhase(f.id, 5) < 0.5 ? 1 : -1;
    const start = idPhase(f.id, 6) * Math.PI * 2;
    animators.set(f.id, (t) => {
      const a = start + (spin * FORKLIFT_PACE * t) / r;
      return withXZ(
        rest,
        rest.x + r * Math.cos(a),
        rest.z + r * Math.sin(a),
        headingOf(-spin * Math.sin(a), spin * Math.cos(a)),
      );
    });
  }

  return {
    ids: new Set(animators.keys()),
    poseAt: (id, t) => animators.get(id)?.(t),
    route: (id) => routes.get(id),
  };
};
