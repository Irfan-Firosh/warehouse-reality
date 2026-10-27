"use client";

import type { OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { ComponentRef, RefObject } from "react";
import { Vector3 } from "three";

export interface CameraGoal {
  position: Vector3;
  target: Vector3;
}

interface CameraRigProps {
  controls: RefObject<ComponentRef<typeof OrbitControls> | null>;
  /** Set to start a glide; the rig clears it on arrival. Clear it to cancel. */
  goal: RefObject<CameraGoal | null>;
}

// Higher is faster; 5 settles in roughly 700 ms, matching the dashboard's arrival timing.
const STIFFNESS = 5;
const ARRIVED = 1;

const reducedMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Eases the orbit camera toward a goal pose with frame-rate-independent damping. */
export const CameraRig = ({ controls, goal }: CameraRigProps) => {
  useFrame((_, delta) => {
    const c = controls.current;
    const g = goal.current;
    if (!c || !g) return;

    const t = reducedMotion() ? 1 : 1 - Math.exp(-STIFFNESS * delta);
    c.object.position.lerp(g.position, t);
    c.target.lerp(g.target, t);
    c.update();

    if (
      c.object.position.distanceTo(g.position) < ARRIVED &&
      c.target.distanceTo(g.target) < ARRIVED
    ) {
      goal.current = null;
    }
  });
  return null;
};

export const goalFrom = (
  position: readonly [number, number, number],
  target: readonly [number, number, number],
): CameraGoal => ({
  position: new Vector3(...position),
  target: new Vector3(...target),
});
