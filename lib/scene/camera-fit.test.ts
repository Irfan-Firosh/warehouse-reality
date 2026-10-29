import { describe, expect, it } from "vitest";
import {
  type Bounds,
  type CameraPose,
  CHASE_DISTANCE,
  CHASE_PITCH,
  CHASE_SWAP_FT,
  chaseAzimuth,
  chasePose,
  EVEN_INSETS,
  fitCamera,
  layoutBounds,
  MINIATURE_VIEW,
  type ScreenInsets,
  SITE_BOUNDS,
  type Vec3,
} from "./camera-fit";
import {
  CLOSED_DOOR,
  ILLUSTRATIVE_STATE,
  TARGET_DOOR,
} from "./illustrative-state";
import { buildLayout } from "./layout";

const VIEW = MINIATURE_VIEW;
const LAYOUT = buildLayout(ILLUSTRATIVE_STATE, [CLOSED_DOOR, TARGET_DOOR]);
const SCENE_BOUNDS = layoutBounds(LAYOUT.values());

/** Screen position of `p` as a fraction of the half-extents (|value| <= 1 means on screen). */
const project = (
  pose: CameraPose,
  p: Vec3,
  aspect: number,
): [number, number] => {
  const f = pose.target.map((t, i) => t - pose.position[i]);
  const n = Math.hypot(...f);
  const fwd = f.map((v) => v / n);
  const right = [-fwd[2], 0, fwd[0]];
  const rn = Math.hypot(...right);
  const r = right.map((v) => v / rn);
  const up = [
    r[1] * fwd[2] - r[2] * fwd[1],
    r[2] * fwd[0] - r[0] * fwd[2],
    r[0] * fwd[1] - r[1] * fwd[0],
  ];
  const rel = p.map((v, i) => v - pose.position[i]);
  const depth = rel.reduce((s, v, i) => s + v * fwd[i], 0);
  const tanY = Math.tan(VIEW.fovY / 2);
  return [
    rel.reduce((s, v, i) => s + v * r[i], 0) / depth / (tanY * aspect),
    rel.reduce((s, v, i) => s + v * up[i], 0) / depth / tanY,
  ];
};

const cornersOf = ({ min, max }: Bounds): Vec3[] =>
  [0, 1, 2, 3, 4, 5, 6, 7].map((k) => [
    k & 1 ? max[0] : min[0],
    k & 2 ? max[1] : min[1],
    k & 4 ? max[2] : min[2],
  ]);

const distance = (pose: CameraPose): number =>
  Math.hypot(...pose.position.map((v, i) => v - pose.target[i]));

/** Projected [min, max] of the bounds' corners on each screen axis. */
const extentsOf = (
  pose: CameraPose,
  bounds: Bounds,
  aspect: number,
): { x: [number, number]; y: [number, number] } => {
  const pts = cornersOf(bounds).map((c) => project(pose, c, aspect));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return {
    x: [Math.min(...xs), Math.max(...xs)],
    y: [Math.min(...ys), Math.max(...ys)],
  };
};

describe("fitCamera", () => {
  it.each([
    0.6, 1.9, 2.7,
  ])("centres the whole scene on screen at aspect %s", (aspect) => {
    const pose = fitCamera(SCENE_BOUNDS, VIEW, aspect);
    const { x, y } = extentsOf(pose, SCENE_BOUNDS, aspect);
    for (const v of [...x, ...y]) {
      expect(Math.abs(v)).toBeLessThanOrEqual(0.96 + 1e-9);
    }
    expect(x[0] + x[1]).toBeCloseTo(0, 6);
    expect(y[0] + y[1]).toBeCloseTo(0, 6);
    // Tight: the limiting axis touches the margin on both sides.
    expect(Math.max(x[1], y[1])).toBeCloseTo(0.96, 6);
  });

  it("centres the scene in the area left free by uneven insets", () => {
    const aspect = 16 / 9;
    const insets: ScreenInsets = {
      top: 0.06,
      right: 0.01,
      bottom: 0.05,
      left: 0.03,
    };
    const pose = fitCamera(SCENE_BOUNDS, VIEW, aspect, insets);
    const { x, y } = extentsOf(pose, SCENE_BOUNDS, aspect);
    const free = {
      x: [-1 + 2 * insets.left, 1 - 2 * insets.right],
      y: [-1 + 2 * insets.bottom, 1 - 2 * insets.top],
    };
    expect(x[0]).toBeGreaterThanOrEqual(free.x[0] - 1e-9);
    expect(x[1]).toBeLessThanOrEqual(free.x[1] + 1e-9);
    expect(y[0]).toBeGreaterThanOrEqual(free.y[0] - 1e-9);
    expect(y[1]).toBeLessThanOrEqual(free.y[1] + 1e-9);
    expect(x[0] + x[1]).toBeCloseTo(free.x[0] + free.x[1], 6);
    expect(y[0] + y[1]).toBeCloseTo(free.y[0] + free.y[1], 6);
  });

  it("moves closer when the viewport is wider than the building's limiting axis", () => {
    expect(distance(fitCamera(SITE_BOUNDS, VIEW, 2.4))).toBeLessThan(
      distance(fitCamera(SITE_BOUNDS, VIEW, 1.2)),
    );
  });

  it("aims from above at the bounds' mid-height", () => {
    const pose = fitCamera(SCENE_BOUNDS, VIEW, 1.6, EVEN_INSETS);
    expect(pose.target[1]).toBeCloseTo(
      (SCENE_BOUNDS.min[1] + SCENE_BOUNDS.max[1]) / 2,
    );
    expect(pose.position[1]).toBeGreaterThan(pose.target[1]);
  });
});

describe("layoutBounds", () => {
  it("contains every placement's footprint", () => {
    for (const p of LAYOUT.values()) {
      const reach = Math.hypot(p.size[0], p.size[2]) / 2;
      expect(p.x - reach).toBeGreaterThanOrEqual(SCENE_BOUNDS.min[0]);
      expect(p.x + reach).toBeLessThanOrEqual(SCENE_BOUNDS.max[0]);
      expect(p.z - reach).toBeGreaterThanOrEqual(SCENE_BOUNDS.min[2]);
      expect(p.z + reach).toBeLessThanOrEqual(SCENE_BOUNDS.max[2]);
      expect(p.y + p.size[1] / 2).toBeLessThanOrEqual(SCENE_BOUNDS.max[1]);
    }
  });

  it("grows the site to include the gate queue outside the courts", () => {
    const gate = ILLUSTRATIVE_STATE.trailers
      .filter((t) => t.status === "gate")
      .map((t) => LAYOUT.get(t.id));
    expect(gate.length).toBeGreaterThan(0);
    for (const p of gate) {
      expect(p).toBeDefined();
      expect(SCENE_BOUNDS.min[0]).toBeLessThan(p?.x ?? 0);
    }
    expect(SCENE_BOUNDS.min[0]).toBeLessThan(SITE_BOUNDS.min[0]);
  });

  it("returns the site itself when nothing is placed", () => {
    expect(layoutBounds([])).toEqual(SITE_BOUNDS);
  });
});

describe("chasePose", () => {
  const truck = {
    x: 100,
    y: 6,
    z: 400,
    rotY: Math.PI / 2,
    size: [8.5, 11, 20] as const,
  };

  it("sits 250 ft away at a 35° pitch, looking at the truck", () => {
    const { position, target } = chasePose(truck, chaseAzimuth(truck));
    expect(target).toEqual([truck.x, truck.y, truck.z]);
    const d = [
      position[0] - target[0],
      position[1] - target[1],
      position[2] - target[2],
    ];
    expect(Math.hypot(...d)).toBeCloseTo(CHASE_DISTANCE, 6);
    const pitch = Math.atan2(d[1], Math.hypot(d[0], d[2]));
    expect(pitch).toBeCloseTo(CHASE_PITCH, 6);
    expect(CHASE_PITCH).toBeCloseTo((35 * Math.PI) / 180, 9);
  });

  it("looks from the yard side the truck is on, away from the building", () => {
    const south = chasePose(truck, chaseAzimuth(truck));
    expect(south.position[2]).toBeGreaterThan(truck.z);
    const north = { ...truck, z: -400 };
    expect(chasePose(north, chaseAzimuth(north)).position[2]).toBeLessThan(
      north.z,
    );
  });

  it("swaps yard sides only once the truck is well into the other yard", () => {
    const south = chaseAzimuth(truck);
    const north = chaseAzimuth({ ...truck, z: -400 });
    const at = (z: number, side: number) => chaseAzimuth({ ...truck, z }, side);
    expect(at(-CHASE_SWAP_FT + 1, south)).toBe(south);
    expect(at(-CHASE_SWAP_FT - 1, south)).toBe(north);
    expect(at(CHASE_SWAP_FT - 1, north)).toBe(north);
    expect(at(CHASE_SWAP_FT + 1, north)).toBe(south);
  });
});
