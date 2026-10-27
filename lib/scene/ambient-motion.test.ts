import { describe, expect, it } from "vitest";
import { createAmbientMotion, quantize } from "./ambient-motion";
import { layoutBounds } from "./camera-fit";
import {
  CLOSED_DOOR,
  ILLUSTRATIVE_STATE,
  MOVING_TRAILER,
  TARGET_DOOR,
} from "./illustrative-state";
import {
  buildLayout,
  GATE_FRONT_Z,
  HITCH,
  MOVE_LANE_Z,
  trailerAtDoor,
} from "./layout";
import type { Placement, SceneState, Trailer } from "./types";

const state = ILLUSTRATIVE_STATE;
const layout = buildLayout(state, [CLOSED_DOOR, TARGET_DOOR]);
const motion = createAmbientMotion(state, layout);
const MINUTE = Array.from({ length: 121 }, (_, k) => k * 0.5);

describe("quantize", () => {
  it("is the identity at 1×", () => {
    expect(quantize(3.217, 1)).toBe(3.217);
  });

  it("holds between 8 Hz wall-clock steps when time-lapsed", () => {
    // At 4× a wall-clock eighth of a second spans 0.5 display seconds.
    expect(quantize(0.49, 4)).toBe(0);
    expect(quantize(0.5, 4)).toBe(0.5);
    expect(quantize(3.99, 16)).toBe(2);
    expect(quantize(4, 16)).toBe(4);
  });
});

describe("createAmbientMotion", () => {
  it("animates trucks on the move, the gate queue, idle yard tractors and working forklifts only", () => {
    expect(motion.ids.has(MOVING_TRAILER)).toBe(true);
    expect(motion.ids.has("YT-2")).toBe(true);
    expect(motion.ids.has("T-4101")).toBe(true);
    expect(motion.ids.has("YT-1")).toBe(true);
    expect(motion.ids.has("F-01")).toBe(true);
    expect(motion.ids.has("F-07")).toBe(false);
    expect(motion.ids.has(CLOSED_DOOR)).toBe(false);
    for (const t of state.trailers.filter(
      (x) => x.status === "parked" || x.status === "serving",
    )) {
      expect(motion.ids.has(t.id)).toBe(false);
    }
    expect(motion.poseAt("D-001", 10)).toBeUndefined();
  });

  it("is deterministic for the same display time", () => {
    for (const id of motion.ids) {
      expect(motion.poseAt(id, 37.5)).toEqual(motion.poseAt(id, 37.5));
    }
  });

  it("keeps every moving entity inside the site bounds", () => {
    const { min, max } = layoutBounds(layout.values());
    for (const id of motion.ids) {
      for (const t of MINUTE) {
        const p = motion.poseAt(id, t);
        if (!p) throw new Error(`no pose for ${id}`);
        const reach = Math.hypot(p.size[0], p.size[2]) / 2;
        expect(p.x - reach).toBeGreaterThanOrEqual(min[0] - 1e-6);
        expect(p.x + reach).toBeLessThanOrEqual(max[0] + 1e-6);
        expect(p.z - reach).toBeGreaterThanOrEqual(min[2] - 1e-6);
        expect(p.z + reach).toBeLessThanOrEqual(max[2] + 1e-6);
      }
    }
  });

  it("keeps each tractor hitched to the trailer it pulls", () => {
    const pairs = state.tractors.flatMap((tr) =>
      tr.at && motion.ids.has(tr.at) ? [[tr.id, tr.at] as const] : [],
    );
    expect(pairs.length).toBeGreaterThan(1);
    for (const [tractor, trailer] of pairs) {
      for (const t of MINUTE) {
        const a = motion.poseAt(tractor, t);
        const b = motion.poseAt(trailer, t);
        if (!a || !b) throw new Error("missing pose");
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeCloseTo(HITCH, 6);
      }
    }
  });

  it("routes the moving trailer from door A to door B", () => {
    const route = motion.route(MOVING_TRAILER);
    if (!route) throw new Error("no route");
    const index = new Map(state.doors.map((d) => [d.id, d.index]));
    const a = trailerAtDoor(index.get(CLOSED_DOOR) ?? -1);
    const b = trailerAtDoor(index.get(TARGET_DOOR) ?? -1);
    expect(route[0]).toEqual([a.x, a.z]);
    expect(route[route.length - 1]).toEqual([b.x, b.z]);
    expect(motion.route("YT-2")).toBe(route);
  });

  it("moves something over time", () => {
    const moved = [...motion.ids].filter((id) => {
      const a = motion.poseAt(id, 0);
      const b = motion.poseAt(id, 30);
      return a && b && Math.hypot(a.x - b.x, a.z - b.z) > 1;
    });
    expect(moved.length).toBeGreaterThan(motion.ids.size / 2);
  });

  it("animates nothing in a state with no trucks or forklifts", () => {
    const bare = { ...state, trailers: [], tractors: [], forklifts: [] };
    const m = createAmbientMotion(
      bare,
      buildLayout(bare, [CLOSED_DOOR, TARGET_DOOR]),
    );
    expect(m.ids.size).toBe(0);
  });

  const withTrailers = (extra: readonly Trailer[]): SceneState => ({
    ...state,
    trailers: [...state.trailers, ...extra],
  });
  const motionOf = (s: SceneState) =>
    createAmbientMotion(s, buildLayout(s, [CLOSED_DOOR, TARGET_DOOR]));
  const doorAt = (id: string): Placement => {
    const index = state.doors.find((d) => d.id === id)?.index;
    if (index === undefined) throw new Error(`no door ${id}`);
    return trailerAtDoor(index);
  };

  it("gives each moving trailer the route between its own doors", () => {
    const s = withTrailers([
      { id: "T-X", kind: "trailer", status: "moving", at: "P-001→D-112" },
      { id: "T-Y", kind: "trailer", status: "moving", at: "D-020→D-030" },
    ]);
    const m = motionOf(s);
    expect(m.ids.has("T-X")).toBe(false);
    const own = m.route(MOVING_TRAILER);
    const other = m.route("T-Y");
    if (!own || !other) throw new Error("no route");
    const a = doorAt(CLOSED_DOOR);
    expect(own[0]).toEqual([a.x, a.z]);
    const [c, d] = [doorAt("D-020"), doorAt("D-030")];
    expect(other[0]).toEqual([c.x, c.z]);
    expect(other[other.length - 1]).toEqual([d.x, d.z]);
  });

  it("routes a move between opposite walls around the building end, inside the bounds", () => {
    const s = withTrailers([
      { id: "T-Z", kind: "trailer", status: "moving", at: "D-010→D-150" },
    ]);
    const layoutZ = buildLayout(s, [CLOSED_DOOR, TARGET_DOOR]);
    const m = createAmbientMotion(s, layoutZ);
    const route = m.route("T-Z");
    if (!route) throw new Error("no route");
    const [a, b] = [doorAt("D-010"), doorAt("D-150")];
    expect(route[0]).toEqual([a.x, a.z]);
    expect(route[route.length - 1]).toEqual([b.x, b.z]);
    expect(route.some(([, z]) => z === -MOVE_LANE_Z)).toBe(true);
    expect(route.some(([, z]) => z === MOVE_LANE_Z)).toBe(true);
    const { min, max } = layoutBounds(layoutZ.values());
    for (const t of MINUTE.map((x) => x * 4)) {
      const p = m.poseAt("T-Z", t);
      if (!p) throw new Error("no pose");
      const reach = Math.hypot(p.size[0], p.size[2]) / 2;
      expect(p.x - reach).toBeGreaterThanOrEqual(min[0] - 1e-6);
      expect(p.x + reach).toBeLessThanOrEqual(max[0] + 1e-6);
      expect(p.z - reach).toBeGreaterThanOrEqual(min[2] - 1e-6);
      expect(p.z + reach).toBeLessThanOrEqual(max[2] + 1e-6);
    }
  });

  it("turns trucks through corners instead of snapping the tractor round", () => {
    const step = 0.05;
    let prev: { trailer: Placement; tractor: Placement } | undefined;
    for (let t = 0; t < 120; t += step) {
      const trailer = motion.poseAt(MOVING_TRAILER, t);
      const tractor = motion.poseAt("YT-2", t);
      if (!trailer || !tractor) throw new Error("missing pose");
      const wrapped =
        prev &&
        Math.hypot(trailer.x - prev.trailer.x, trailer.z - prev.trailer.z) > 5;
      if (prev && !wrapped) {
        const jump = Math.hypot(
          tractor.x - prev.tractor.x,
          tractor.z - prev.tractor.z,
        );
        expect(jump).toBeLessThan(5);
      }
      prev = { trailer, tractor };
    }
  });

  it("rests the gate queue behind the gate front and only passes it while creeping", () => {
    const gate = state.trailers.filter((x) => x.at === "gate queue");
    expect(gate.length).toBeGreaterThan(1);
    const zs = gate.map((g) => motion.poseAt(g.id, 1)?.z ?? Number.NaN);
    for (const z of zs) expect(z).toBeLessThanOrEqual(GATE_FRONT_Z + 1e-6);
    expect(new Set(zs).size).toBe(gate.length);
  });

  it("holds a gate queue of one still", () => {
    const one = state.trailers.filter((x) => x.at === "gate queue").slice(0, 1);
    const s = {
      ...state,
      trailers: [
        ...state.trailers.filter((x) => x.at !== "gate queue"),
        ...one,
      ],
    };
    const m = motionOf(s);
    const id = one[0].id;
    for (const t of MINUTE) {
      expect(m.poseAt(id, t)?.z).toBeCloseTo(GATE_FRONT_Z, 6);
    }
  });

  it("picks the gate queue by location, not by a stale status", () => {
    const s = withTrailers([
      { id: "T-S", kind: "trailer", status: "gate", at: "P-002" },
    ]);
    expect(motionOf(s).ids.has("T-S")).toBe(false);
  });
});
