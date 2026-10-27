// Fits a fixed-angle camera to the site so the facility fills the view at any
// viewport shape. Pure math; no React or three.js.
import { HALF_D, HALF_L, S1 } from "./facility";
import type { Placement } from "./types";

export type Vec3 = readonly [number, number, number];

export interface Bounds {
  min: Vec3;
  max: Vec3;
}

export interface CameraPose {
  position: Vec3;
  target: Vec3;
}

export interface ViewAngles {
  /** Elevation above the ground plane in radians, between 0 and 89°. */
  pitch: number;
  /** Rotation about the vertical axis in radians; 0 looks from +z (south) toward the building. */
  azimuth: number;
  /** Vertical field of view in radians. */
  fovY: number;
}

/** Free space to leave on each side, as a fraction of the viewport (0.05 = 5%). */
export interface ScreenInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const EVEN_INSETS: ScreenInsets = {
  top: 0.02,
  right: 0.02,
  bottom: 0.02,
  left: 0.02,
};

const DEG = Math.PI / 180;
/** The scene's high oblique view with a longish lens, as tilt-shift miniatures are shot. */
export const MINIATURE_VIEW: ViewAngles = {
  pitch: DEG * 50,
  azimuth: DEG * -10,
  fovY: DEG * 28,
};

const COURT_W = S1.courtDepth + S1.trailerParkDepth;

/** Building plus both truck courts: the site that is always shown, even with no entities. */
export const SITE_BOUNDS: Bounds = {
  min: [-HALF_L, 0, -HALF_D - COURT_W],
  max: [HALF_L, S1.clearHeight, HALF_D + COURT_W],
};

/** The site grown to include every placed entity (gate queues and the yard sit outside the courts). */
export const layoutBounds = (
  placements: Iterable<Placement>,
  base: Bounds = SITE_BOUNDS,
): Bounds => {
  const min = [...base.min];
  const max = [...base.max];
  for (const p of placements) {
    const reach = Math.hypot(p.size[0], p.size[2]) / 2;
    const at = [p.x, p.y, p.z];
    const half = [reach, p.size[1] / 2, reach];
    for (const i of [0, 1, 2]) {
      min[i] = Math.min(min[i], at[i] - half[i]);
      max[i] = Math.max(max[i], at[i] + half[i]);
    }
  }
  return { min: [min[0], min[1], min[2]], max: [max[0], max[1], max[2]] };
};

const dot = (a: Vec3, b: Vec3): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: Vec3): Vec3 => {
  const n = Math.hypot(...a);
  return [a[0] / n, a[1] / n, a[2] / n];
};

const corners = ({ min, max }: Bounds): Vec3[] =>
  [0, 1, 2, 3, 4, 5, 6, 7].map((k) => [
    k & 1 ? max[0] : min[0],
    k & 2 ? max[1] : min[1],
    k & 4 ? max[2] : min[2],
  ]);

/** Unit vector from the target toward the camera. */
export const viewDirection = ({ pitch, azimuth }: ViewAngles): Vec3 => [
  Math.sin(azimuth) * Math.cos(pitch),
  Math.sin(pitch),
  Math.cos(azimuth) * Math.cos(pitch),
];

/** A corner seen along one screen axis: `s` across the screen, `d` in depth. */
interface AxisPoint {
  s: number;
  d: number;
}

const pairs = (pts: readonly AxisPoint[]): [AxisPoint, AxisPoint][] =>
  pts.flatMap((a) => pts.map((b): [AxisPoint, AxisPoint] => [a, b]));

/** Least pull-back that fits every point within ±half (tangent units) on this axis. */
const pullBack = (pts: readonly AxisPoint[], half: number): number =>
  Math.max(...pairs(pts).map(([a, b]) => ((a.s - b.s) / half - a.d - b.d) / 2));

/** Camera offset along the axis that centres the projected extents at pull-back `t`. */
const centredOffset = (pts: readonly AxisPoint[], t: number): number => {
  const spread = Math.max(
    0,
    ...pairs(pts)
      .filter(([a, b]) => a !== b)
      .map(([a, b]) => (a.s - b.s) / (a.d + b.d + 2 * t)),
  );
  const low = Math.max(...pts.map((p) => p.s - spread * (p.d + t)));
  const high = Math.min(...pts.map((p) => p.s + spread * (p.d + t)));
  return (low + high) / 2;
};

/**
 * The closest camera with the given view angles that shows every corner of
 * `bounds` inside the viewport minus `insets`, with the projected site centred
 * in that free area. It aims at the bounds' mid-height so orbiting pivots on the site.
 */
export const fitCamera = (
  bounds: Bounds,
  view: ViewAngles,
  aspect: number,
  insets: ScreenInsets = EVEN_INSETS,
): CameraPose => {
  const centre: Vec3 = [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ];
  const back = viewDirection(view);
  const forward: Vec3 = [-back[0], -back[1], -back[2]];
  const right = unit(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const tanY = Math.tan(view.fovY / 2);
  const axes = [
    { dir: right, tan: tanY * aspect, lo: insets.left, hi: insets.right },
    { dir: up, tan: tanY, lo: insets.bottom, hi: insets.top },
  ].map(({ dir, tan, lo, hi }) => {
    // The free range is [mid - half, mid + half]; shifting by mid·depth makes it symmetric.
    const mid = tan * (lo - hi);
    const pts = corners(bounds).map((c): AxisPoint => {
      const rel = sub(c, centre);
      const d = dot(rel, forward);
      return { s: dot(rel, dir) - mid * d, d };
    });
    return { dir, mid, half: tan * (1 - lo - hi), pts };
  });
  const t = Math.max(...axes.map((a) => pullBack(a.pts, a.half)));
  const position = axes.reduce<Vec3>(
    (at, a) => {
      const k = centredOffset(a.pts, t) - a.mid * t;
      return [at[0] + a.dir[0] * k, at[1] + a.dir[1] * k, at[2] + a.dir[2] * k];
    },
    [
      centre[0] - forward[0] * t,
      centre[1] - forward[1] * t,
      centre[2] - forward[2] * t,
    ],
  );
  const reach = (position[1] - centre[1]) / -forward[1];
  return {
    position,
    target: [
      position[0] + forward[0] * reach,
      position[1] + forward[1] * reach,
      position[2] + forward[2] * reach,
    ],
  };
};
