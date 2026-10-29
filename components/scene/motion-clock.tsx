"use client";

import { useFrame } from "@react-three/fiber";
import { type RefObject, useRef } from "react";
import {
  type AmbientMotion,
  type DisplaySpeed,
  quantize,
} from "@/lib/scene/ambient-motion";
import type { Placement } from "@/lib/scene/types";

/** Where each entity is drawn this frame; written once per frame, read by everything that draws or aims at it. */
export type LivePoses = Map<string, Placement>;

/**
 * The display clock. It lives outside the Canvas so a graphics-context
 * remount keeps the trucks where they are. `shown` is the time on screen;
 * `base` is the shown time at the last speed change, so stepping restarts
 * there and never shows an earlier time.
 */
export interface DisplayClock {
  t: number;
  base: number;
  shown: number;
  speed: DisplaySpeed;
}

export const newDisplayClock = (): DisplayClock => ({
  t: 0,
  base: 0,
  shown: 0,
  speed: 1,
});

/** Before the follow rig (-1.5), the orbit controls (-1) and every default (0) frame callback; negative priorities leave rendering to R3F. */
const BEFORE_CONSUMERS = -2;
/** A long frame (tab in the background) advances the display clock by at most this much. */
const MAX_STEP_S = 0.1;

interface MotionClockProps {
  motion: AmbientMotion;
  layout: ReadonlyMap<string, Placement>;
  live: RefObject<LivePoses>;
  /** Bumped whenever `live` changes, so readers can skip frames where nothing moved. */
  version: RefObject<number>;
  clock: RefObject<DisplayClock>;
  on: boolean;
  speed: DisplaySpeed;
}

/**
 * Advances the illustrative display clock and writes every animated entity's
 * pose into `live`; with motion off, each one goes back to its layout pose.
 */
export const MotionClock = ({
  motion,
  layout,
  live,
  version,
  clock,
  on,
  speed,
}: MotionClockProps) => {
  const written = useRef<{
    shown: number;
    on: boolean;
    motion: AmbientMotion;
  } | null>(null);

  useFrame((_, delta) => {
    const c = clock.current;
    if (c.speed !== speed) {
      c.base = c.shown;
      c.t = c.shown;
      c.speed = speed;
    }
    if (on) c.t += Math.min(delta, MAX_STEP_S) * speed;
    c.shown = c.base + quantize(c.t - c.base, speed);

    const last = written.current;
    if (
      last &&
      last.shown === c.shown &&
      last.on === on &&
      last.motion === motion
    )
      return;
    written.current = { shown: c.shown, on, motion };
    for (const id of motion.ids) {
      const pose = (on && motion.poseAt(id, c.shown)) || layout.get(id);
      if (pose) live.current.set(id, pose);
    }
    version.current += 1;
  }, BEFORE_CONSUMERS);

  return null;
};
