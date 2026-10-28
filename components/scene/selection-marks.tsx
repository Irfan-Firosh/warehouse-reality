"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type RefObject, useRef } from "react";
import type * as THREE from "three";
import { KIND_LABEL, statusText } from "@/lib/scene/status-text";
import type { Entity, Placement } from "@/lib/scene/types";
import { STATUS } from "./palette";

const HIGHLIGHT_PAD = (s: number): number => s * 1.12 + 2;
/**
 * Pointer hover is only re-tested when the pointer moves, so a truck that
 * drives out from under a still cursor would keep its tooltip; past this
 * drift (ft) the hover is dropped.
 */
const HOVER_DRIFT_FT = 6;

interface SelectionMarksProps {
  selectedId: string | null;
  hovered: Entity | undefined;
  /** Where every entity is drawn this frame. */
  poses: RefObject<ReadonlyMap<string, Placement>>;
  /** Called once when the hovered entity has driven away from where it was hovered. */
  onHoverLost: () => void;
}

const placeBox = (box: THREE.Object3D, at: Placement) => {
  box.position.set(at.x, at.y, at.z);
  box.rotation.set(0, at.rotY, 0);
  box.scale.set(
    HIGHLIGHT_PAD(at.size[0]),
    HIGHLIGHT_PAD(at.size[1]),
    HIGHLIGHT_PAD(at.size[2]),
  );
};

/** Translucent box around the selected entity and a tooltip over the hovered one; both ride along with moving entities. */
export const SelectionMarks = ({
  selectedId,
  hovered,
  poses,
  onHoverLost,
}: SelectionMarksProps) => {
  const box = useRef<THREE.Mesh>(null);
  const tip = useRef<THREE.Group>(null);
  /** Where the hovered entity was when the hover began. */
  const anchor = useRef<{ id: string; x: number; z: number } | null>(null);

  useFrame(() => {
    const sel = selectedId ? poses.current.get(selectedId) : undefined;
    if (box.current && sel) placeBox(box.current, sel);
    const hov = hovered ? poses.current.get(hovered.id) : undefined;
    if (!hovered || !hov) {
      anchor.current = null;
      return;
    }
    const from = anchor.current;
    if (!from || from.id !== hovered.id) {
      anchor.current = { id: hovered.id, x: hov.x, z: hov.z };
    } else if (Math.hypot(hov.x - from.x, hov.z - from.z) > HOVER_DRIFT_FT) {
      anchor.current = null;
      onHoverLost();
      return;
    }
    tip.current?.position.set(hov.x, hov.y + hov.size[1], hov.z);
  });

  const sel = selectedId ? poses.current.get(selectedId) : undefined;
  const hov = hovered ? poses.current.get(hovered.id) : undefined;
  return (
    <>
      {sel && (
        <mesh ref={box} onUpdate={(m) => placeBox(m, sel)}>
          <boxGeometry />
          <meshBasicMaterial
            color={STATUS.selected}
            transparent
            opacity={0.3}
            depthWrite={false}
          />
        </mesh>
      )}
      {hovered && hov && (
        <group ref={tip} position={[hov.x, hov.y + hov.size[1], hov.z]}>
          <Html className="pointer-events-none">
            <div className="w-max max-w-64 rounded-md border border-zinc-700 bg-zinc-900/95 px-2.5 py-1.5 text-xs text-zinc-100">
              <b className="font-mono">{hovered.id}</b> ·{" "}
              {KIND_LABEL[hovered.kind]}
              <br />
              {statusText(hovered)}
            </div>
          </Html>
        </group>
      )}
    </>
  );
};
