"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useEffect, useRef } from "react";
import { chaseAzimuth, chasePose } from "@/lib/scene/camera-fit";
import { followStep, isSettled } from "@/lib/scene/follow";
import type { Placement } from "@/lib/scene/types";
import { isOrbit } from "./camera-rig";

/** After the motion clock (-2) writes poses, before drei's OrbitControls update (-1) applies the move. */
const BEFORE_ORBIT_UPDATE = -1.5;

interface FollowRigProps {
  followId: string | null;
  poses: RefObject<ReadonlyMap<string, Placement>>;
}

/**
 * Carries camera and orbit target along with the followed truck each frame,
 * so orbiting and zooming around it still work. It eases into a chase view
 * from the truck's yard side, and again when the truck crosses into the other
 * yard; grabbing the controls ends an ease.
 */
export const FollowRig = ({ followId, poses }: FollowRigProps) => {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  /** The truck the per-frame state below belongs to; a new one restarts the settle. */
  const subject = useRef<string | null>(null);
  const last = useRef<Placement | null>(null);
  const settling = useRef(true);
  const side = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!isOrbit(controls)) return;
    const onStart = () => {
      settling.current = false;
    };
    controls.addEventListener("start", onStart);
    return () => controls.removeEventListener("start", onStart);
  }, [controls]);

  useFrame((_, delta) => {
    if (subject.current !== followId) {
      subject.current = followId;
      last.current = null;
      side.current = undefined;
    }
    if (!followId || !isOrbit(controls)) return;
    const pose = poses.current.get(followId);
    if (!pose) return;
    const prev = last.current ?? pose;
    last.current = pose;
    const nextSide = chaseAzimuth(pose, side.current);
    if (nextSide !== side.current) settling.current = true;
    side.current = nextSide;
    const goal = settling.current ? chasePose(pose, nextSide) : null;
    const view = followStep(
      {
        position: camera.position.toArray(),
        target: controls.target.toArray(),
      },
      { dx: pose.x - prev.x, dz: pose.z - prev.z },
      goal,
      delta,
    );
    camera.position.set(...view.position);
    controls.target.set(...view.target);
    if (goal && isSettled(view, goal)) settling.current = false;
  }, BEFORE_ORBIT_UPDATE);

  return null;
};
