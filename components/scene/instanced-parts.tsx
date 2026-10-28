"use client";

import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { type RefObject, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ModelPart } from "@/lib/scene/fit-model";
import type { Placement } from "@/lib/scene/types";
import { WHITE } from "./palette";

export interface InstanceItem {
  x: number;
  y: number;
  z: number;
  rotY: number;
  id?: string;
}

export interface PickHandlers {
  onHover: (id: string | null) => void;
  /** `null` clears the selection (a click on the ground, shell or sky). */
  onSelect: (id: string | null) => void;
}

/** Items whose ids are in `ids` follow their pose in `poses` whenever `version` changes. */
export interface LiveInstances<T extends InstanceItem> {
  poses: RefObject<ReadonlyMap<string, Placement>>;
  version: RefObject<number>;
  ids: ReadonlySet<string>;
  /** The instance transform for an item drawn at `pose`. */
  toItem: (pose: Placement, item: T) => InstanceItem;
}

interface InstancedPartsProps<T extends InstanceItem> {
  parts: readonly ModelPart[];
  items: readonly T[];
  colorOf: (item: T) => number;
  pick?: PickHandlers;
  live?: LiveInstances<T>;
}

const UP = new THREE.Vector3(0, 1, 0);
const ONE = new THREE.Vector3(1, 1, 1);
// Scratch objects for composing matrices without allocating three.js objects per instance.
const AT = new THREE.Vector3();
const TURN = new THREE.Quaternion();
const MATRIX = new THREE.Matrix4();
const matrixOf = (it: InstanceItem): THREE.Matrix4 =>
  MATRIX.compose(
    AT.set(it.x, it.y, it.z),
    TURN.setFromAxisAngle(UP, it.rotY),
    ONE,
  );

/** One InstancedMesh per model part, all sharing the same per-item matrices and ids. */
export const InstancedParts = <T extends InstanceItem>({
  parts,
  items,
  colorOf,
  pick,
  live,
}: InstancedPartsProps<T>) => {
  const meshes = useRef<(THREE.InstancedMesh | null)[]>([]);
  /** The live-pose version last copied into the instance matrices; -1 forces a copy. */
  const applied = useRef(-1);
  const moving = useMemo(
    () =>
      live
        ? items.flatMap((it, k) => (it.id && live.ids.has(it.id) ? [k] : []))
        : [],
    [items, live],
  );

  useLayoutEffect(() => {
    for (const i of parts.keys()) {
      const mesh = meshes.current[i];
      if (!mesh) continue;
      for (const [k, it] of items.entries()) mesh.setMatrixAt(k, matrixOf(it));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    // The rest poses just overwrote any moved instances; copy the live ones again next frame.
    applied.current = -1;
  }, [parts, items]);

  useFrame(() => {
    if (!live || moving.length === 0) return;
    if (applied.current === live.version.current) return;
    applied.current = live.version.current;
    const shown = meshes.current.filter((m) => m !== null);
    for (const k of moving) {
      const item = items[k];
      const pose = item.id ? live.poses.current.get(item.id) : undefined;
      if (!pose) continue;
      const matrix = matrixOf(live.toItem(pose, item));
      for (const mesh of shown) mesh.setMatrixAt(k, matrix);
    }
    for (const mesh of shown) {
      mesh.instanceMatrix.needsUpdate = true;
      // Picking and culling test the bounding sphere first, so it must cover the moved instances.
      mesh.computeBoundingSphere();
    }
  });

  useLayoutEffect(() => {
    const c = new THREE.Color();
    meshes.current.forEach((mesh, i) => {
      if (!mesh) return;
      const tinted = parts[i]?.tint ?? false;
      for (const [k, it] of items.entries()) {
        mesh.setColorAt(k, c.setHex(tinted ? colorOf(it) : WHITE));
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  });

  const idAt = (e: ThreeEvent<PointerEvent | MouseEvent>): string | null =>
    e.instanceId === undefined ? null : (items[e.instanceId]?.id ?? null);

  const handlers = pick
    ? {
        onPointerMove: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          pick.onHover(idAt(e));
        },
        onPointerOut: () => pick.onHover(null),
        onClick: (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          const id = idAt(e);
          if (id) pick.onSelect(id);
        },
      }
    : {};

  return (
    <group>
      {parts.map((p, i) => (
        <instancedMesh
          // biome-ignore lint/suspicious/noArrayIndexKey: parts are a fixed list per model
          key={i}
          ref={(m) => {
            meshes.current[i] = m;
          }}
          args={[p.geometry, p.material, items.length]}
          castShadow
          receiveShadow
          {...handlers}
        />
      ))}
    </group>
  );
};
