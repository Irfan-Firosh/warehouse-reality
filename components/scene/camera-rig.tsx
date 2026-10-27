"use client";

import type { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { type ComponentRef, useEffect, useLayoutEffect, useRef } from "react";
import {
  type Bounds,
  fitCamera,
  type ScreenInsets,
  type ViewAngles,
} from "@/lib/scene/camera-fit";

interface CameraRigProps {
  bounds: Bounds;
  view: ViewAngles;
  /** Changing this number sends the camera back to the fitted home view. */
  homeSignal: number;
}

type Orbit = ComponentRef<typeof OrbitControls>;

/** Pixels kept clear of the site for the floating top row, bottom controls and edges. */
const CLEAR_PX = { top: 56, bottom: 48, side: 16 } as const;
/** Cap on any one inset, so small canvases still show the whole site. */
const MAX_INSET = 0.2;

const isOrbit = (c: unknown): c is Orbit =>
  typeof c === "object" && c !== null && "target" in c && "update" in c;

const overlayInsets = (width: number, height: number): ScreenInsets => {
  const side = Math.min(CLEAR_PX.side / width, MAX_INSET);
  return {
    top: Math.min(CLEAR_PX.top / height, MAX_INSET),
    bottom: Math.min(CLEAR_PX.bottom / height, MAX_INSET),
    left: side,
    right: side,
  };
};

/**
 * Frames the site on mount and on reset, and again on resize until the user
 * orbits or zooms; after that a resize keeps their view.
 */
export const CameraRig = ({ bounds, view, homeSignal }: CameraRigProps) => {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const moved = useRef(false);
  const fitted = useRef<{ bounds: Bounds; view: ViewAngles; home: number }>(
    null,
  );

  useEffect(() => {
    if (!isOrbit(controls)) return;
    const onStart = () => {
      moved.current = true;
    };
    controls.addEventListener("start", onStart);
    return () => controls.removeEventListener("start", onStart);
  }, [controls]);

  useLayoutEffect(() => {
    if (width === 0 || height === 0) return;
    const last = fitted.current;
    const reset =
      !last ||
      last.bounds !== bounds ||
      last.view !== view ||
      last.home !== homeSignal;
    if (moved.current && !reset) return;
    fitted.current = { bounds, view, home: homeSignal };
    moved.current = false;
    const pose = fitCamera(
      bounds,
      view,
      width / height,
      overlayInsets(width, height),
    );
    if (isOrbit(controls)) {
      // An undamped update applies and clears leftover orbit/pan inertia before the pose is set.
      controls.enableDamping = false;
      controls.update();
    }
    camera.position.set(...pose.position);
    camera.lookAt(...pose.target);
    if (isOrbit(controls)) {
      controls.target.set(...pose.target);
      controls.update();
      controls.enableDamping = true;
    }
  }, [bounds, view, width, height, camera, controls, homeSignal]);

  return null;
};
