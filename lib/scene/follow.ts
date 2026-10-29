// The follow camera's per-frame step. Pure; no React or three.js.
import type { CameraPose, Vec3 } from "./camera-fit";

/** Settling closes 1 - e^(-rate·dt) of what is left each frame, so it eases the same at any frame rate. */
export const SETTLE_RATE = 5;
/** Settled once camera and target are both this close (ft) to the chase pose. */
export const SETTLED_FT = 2;

/** The followed truck's ground move since the last frame, in ft. */
export interface GroundMove {
  dx: number;
  dz: number;
}

const carry = ([x, y, z]: Vec3, { dx, dz }: GroundMove): Vec3 => [
  x + dx,
  y,
  z + dz,
];

const toward = (a: Vec3, b: Vec3, k: number): Vec3 => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
  a[2] + (b[2] - a[2]) * k,
];

const gap = (a: Vec3, b: Vec3): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Carries the view along with the truck, then, while settling (`goal` set),
 * eases what is left toward the chase pose. Easing in the truck's frame means
 * the settle finishes however fast the truck drives.
 */
export const followStep = (
  view: CameraPose,
  move: GroundMove,
  goal: CameraPose | null,
  dt: number,
): CameraPose => {
  const position = carry(view.position, move);
  const target = carry(view.target, move);
  if (!goal) return { position, target };
  const k = 1 - Math.exp(-SETTLE_RATE * dt);
  return {
    position: toward(position, goal.position, k),
    target: toward(target, goal.target, k),
  };
};

export const isSettled = (view: CameraPose, goal: CameraPose): boolean =>
  gap(view.position, goal.position) <= SETTLED_FT &&
  gap(view.target, goal.target) <= SETTLED_FT;
