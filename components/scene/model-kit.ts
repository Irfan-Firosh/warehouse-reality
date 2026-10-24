import type * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { PROXY } from "@/lib/scene/facility";
import { boxPart, fitModel, type ModelPart } from "@/lib/scene/fit-model";
import { WHITE } from "./palette";

export const MODEL_URLS = {
  semi: "/models/semi-williwam.glb",
  container: "/models/container-quaternius.glb",
  forklift: "/models/forklift-kolos.glb",
  pallet: "/models/pallet-quaternius.glb",
} as const;

export interface Kit {
  tractor: ModelPart[];
  trailerBody: ModelPart[];
  forklift: ModelPart[];
  pallet: ModelPart[];
}

export const CHASSIS_H = 2;
const BODY: readonly [number, number, number] = [
  PROXY.trailer[0],
  PROXY.trailer[1] - CHASSIS_H,
  PROXY.trailer[2],
];
export const PALLET: readonly [number, number, number] = [3.4, 0.55, 4];

export const PRIMITIVE_KIT: Kit = {
  tractor: boxPart(PROXY.tractor),
  trailerBody: boxPart(BODY),
  forklift: boxPart(PROXY.forklift),
  pallet: boxPart(PALLET),
};

const fitKit = (
  semi: THREE.Object3D,
  container: THREE.Object3D,
  forklift: THREE.Object3D,
  pallet: THREE.Object3D,
): Kit => ({
  tractor: fitModel(semi, {
    size: PROXY.tractor,
    uniform: true,
    drop: "spike",
    front: "spike",
    recolor: { base: WHITE },
    tint: ["base"],
  }),
  trailerBody: fitModel(container, {
    size: BODY,
    recolor: { Red: WHITE },
    tint: ["Red"],
  }),
  forklift: fitModel(forklift, {
    size: PROXY.forklift,
    uniform: true,
    tint: "all",
  }),
  pallet: fitModel(pallet, { size: PALLET, uniform: true }),
});

const fetchKit = async (): Promise<Kit> => {
  const loader = new GLTFLoader();
  const [semi, container, forklift, pallet] = await Promise.all(
    [
      MODEL_URLS.semi,
      MODEL_URLS.container,
      MODEL_URLS.forklift,
      MODEL_URLS.pallet,
    ].map((url) => loader.loadAsync(url)),
  );
  return fitKit(semi.scene, container.scene, forklift.scene, pallet.scene);
};

// Loaded and fitted once per page; a failed load is forgotten so a later toggle retries.
let pending: Promise<Kit> | null = null;

/** Loads and fits the free models outside React, so a failure stays a handled fallback. */
export const loadModelKit = (): Promise<Kit> => {
  pending ??= fetchKit().catch((err: unknown) => {
    console.warn("Free models failed to load; showing primitives", err);
    pending = null;
    throw err;
  });
  return pending;
};
