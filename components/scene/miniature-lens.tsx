"use client";

import { useFrame } from "@react-three/fiber";
import {
  BrightnessContrast,
  EffectComposer,
  HueSaturation,
  N8AO,
  TiltShift,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import {
  BlendFunction,
  KernelSize,
  type TiltShiftEffect,
  ToneMappingMode,
} from "postprocessing";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Placement } from "@/lib/scene/types";

/**
 * Half-height of the band in screen units (-1..1), feather included: fully sharp
 * within (area - FEATHER) of the band centre. Wide at rest, narrow on a selection.
 */
const BAND_REST = 0.95;
const BAND_FOCUS = 0.55;
const FEATHER = 0.4;
/** The band sits a little below centre at rest, where the near dock face is. */
const OFFSET_REST = -0.1;
/** Fraction of the remaining distance the band moves per frame, so it glides to a new subject. */
const EASE = 0.12;

interface MiniatureLensProps {
  /** The entity the sharp band follows; the band widens and recentres when nothing is selected. */
  focus: Placement | undefined;
  saturation: number;
}

/**
 * Tilt-shift miniature look (after the Lemo-Opuscar tilt-shift style): a sharp
 * horizontal band that follows the subject, ambient occlusion, a saturated
 * grade and a vignette. Appearance only; it never feeds back into the scene.
 */
export const MiniatureLens = ({ focus, saturation }: MiniatureLensProps) => {
  const tilt = useRef<TiltShiftEffect>(null);
  const at = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera }) => {
    const lens = tilt.current;
    if (!lens) return;
    const seen = focus && at.set(focus.x, focus.y, focus.z).project(camera);
    // Behind the camera or out of frame, the projection says nothing useful; rest instead.
    const onScreen =
      seen &&
      Math.abs(seen.x) <= 1 &&
      Math.abs(seen.y) <= 1 &&
      Math.abs(seen.z) <= 1;
    const offset = onScreen
      ? THREE.MathUtils.clamp(seen.y, -0.9, 0.9)
      : OFFSET_REST;
    const area = onScreen ? BAND_FOCUS : BAND_REST;
    lens.offset += (offset - lens.offset) * EASE;
    lens.focusArea += (area - lens.focusArea) * EASE;
  });

  return (
    <EffectComposer multisampling={4}>
      <N8AO
        aoRadius={18}
        distanceFalloff={1}
        intensity={2.2}
        quality="medium"
        halfRes
      />
      <TiltShift
        ref={tilt}
        blendFunction={BlendFunction.NORMAL}
        offset={OFFSET_REST}
        focusArea={BAND_REST}
        feather={FEATHER}
        kernelSize={KernelSize.MEDIUM}
      />
      <HueSaturation saturation={saturation} />
      <BrightnessContrast contrast={0.08} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <Vignette offset={0.3} darkness={0.45} />
    </EffectComposer>
  );
};
