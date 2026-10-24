"use client";

import { Html } from "@react-three/drei";
import { KIND_LABEL, statusText } from "@/lib/scene/status-text";
import type { Entity, Placement } from "@/lib/scene/types";
import { STATUS } from "./palette";

const HIGHLIGHT_PAD = (s: number): number => s * 1.12 + 2;

interface SelectionMarksProps {
  selected: Placement | undefined;
  hovered: { entity: Entity; at: Placement } | undefined;
}

/** Translucent box around the selected entity and a tooltip over the hovered one. */
export const SelectionMarks = ({ selected, hovered }: SelectionMarksProps) => (
  <>
    {selected && (
      <mesh
        position={[selected.x, selected.y, selected.z]}
        rotation={[0, selected.rotY, 0]}
        scale={[
          HIGHLIGHT_PAD(selected.size[0]),
          HIGHLIGHT_PAD(selected.size[1]),
          HIGHLIGHT_PAD(selected.size[2]),
        ]}
      >
        <boxGeometry />
        <meshBasicMaterial
          color={STATUS.selected}
          transparent
          opacity={0.3}
          depthWrite={false}
        />
      </mesh>
    )}
    {hovered && (
      <Html
        position={[
          hovered.at.x,
          hovered.at.y + hovered.at.size[1],
          hovered.at.z,
        ]}
        className="pointer-events-none"
      >
        <div className="w-max max-w-64 rounded-md border border-zinc-700 bg-zinc-900/95 px-2.5 py-1.5 text-xs text-zinc-100">
          <b className="font-mono">{hovered.entity.id}</b> ·{" "}
          {KIND_LABEL[hovered.entity.kind]}
          <br />
          {statusText(hovered.entity)}
        </div>
      </Html>
    )}
  </>
);
