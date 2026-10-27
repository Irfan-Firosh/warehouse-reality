"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import type { ModelPart } from "@/lib/scene/fit-model";
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

interface InstancedPartsProps<T extends InstanceItem> {
  parts: readonly ModelPart[];
  items: readonly T[];
  colorOf: (item: T) => number;
  pick?: PickHandlers;
}

const UP = new THREE.Vector3(0, 1, 0);
const ONE = new THREE.Vector3(1, 1, 1);
const matrixOf = (it: InstanceItem): THREE.Matrix4 =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(it.x, it.y, it.z),
    new THREE.Quaternion().setFromAxisAngle(UP, it.rotY),
    ONE,
  );

/** One InstancedMesh per model part, all sharing the same per-item matrices and ids. */
export const InstancedParts = <T extends InstanceItem>({
  parts,
  items,
  colorOf,
  pick,
}: InstancedPartsProps<T>) => {
  const meshes = useRef<(THREE.InstancedMesh | null)[]>([]);

  useLayoutEffect(() => {
    for (const i of parts.keys()) {
      const mesh = meshes.current[i];
      if (!mesh) continue;
      for (const [k, it] of items.entries()) mesh.setMatrixAt(k, matrixOf(it));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [parts, items]);

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
