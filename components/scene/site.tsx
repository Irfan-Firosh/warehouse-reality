"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useMemo } from "react";
import { HALF_D, HALF_L, S1 } from "@/lib/scene/facility";
import { boxPart } from "@/lib/scene/fit-model";
import type { Placement, SceneState } from "@/lib/scene/types";
import { InstancedParts, type PickHandlers } from "./instanced-parts";
import { atBottom, type EntityItem, placed } from "./items";
import { type ScenePalette, statusColor } from "./palette";

const COURT_W = S1.courtDepth + S1.trailerParkDepth;
const WALL_H = S1.clearHeight + 4;

/** Ground, courts and shell block picks so hidden entities behind them stay unpicked; a click on them clears the selection. */
const blockPick = (pick: PickHandlers) => ({
  onPointerMove: (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    pick.onHover(null);
  },
  onClick: (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    pick.onSelect(null);
  },
});

interface SlabProps {
  size: [number, number, number];
  position: [number, number, number];
  color: number;
  pick: PickHandlers;
}

const Slab = ({ size, position, color, pick }: SlabProps) => (
  <mesh position={position} {...blockPick(pick)}>
    <boxGeometry args={size} />
    <meshLambertMaterial color={color} />
  </mesh>
);

interface ShellProps {
  palette: ScenePalette;
  roof: boolean;
  pick: PickHandlers;
}

export const Shell = ({ palette: p, roof, pick }: ShellProps) => {
  const walls: [[number, number, number], [number, number, number]][] = [
    [
      [S1.length, WALL_H, 2],
      [0, WALL_H / 2, -HALF_D],
    ],
    [
      [S1.length, WALL_H, 2],
      [0, WALL_H / 2, HALF_D],
    ],
    [
      [2, WALL_H, S1.depth],
      [-HALF_L, WALL_H / 2, 0],
    ],
    [
      [2, WALL_H, S1.depth],
      [HALF_L, WALL_H / 2, 0],
    ],
  ];
  return (
    <group>
      <Slab
        size={[S1.length + 900, 1, S1.depth + 2 * COURT_W + 500]}
        position={[0, -1, 0]}
        color={p.ground}
        pick={pick}
      />
      {[-1, 1].map((side) => (
        <Slab
          key={side}
          size={[S1.length + 120, 0.5, COURT_W]}
          position={[0, 0, side * (HALF_D + COURT_W / 2)]}
          color={p.asphalt}
          pick={pick}
        />
      ))}
      <Slab
        size={[S1.length, 0.6, S1.depth]}
        position={[0, 0.4, 0]}
        color={p.floor}
        pick={pick}
      />
      {walls.map(([size, position]) => (
        <Slab
          key={position.join()}
          size={size}
          position={position}
          color={p.wall}
          pick={pick}
        />
      ))}
      {roof && (
        <Slab
          size={[S1.length, 2, S1.depth]}
          position={[0, WALL_H + 1, 0]}
          color={p.roof}
          pick={pick}
        />
      )}
    </group>
  );
};

interface FixturesProps {
  state: SceneState;
  layout: ReadonlyMap<string, Placement>;
  palette: ScenePalette;
  pick: PickHandlers;
}

/** Every S1 door, ramp and trailer space as its own pickable identity. */
export const Fixtures = ({ state, layout, palette, pick }: FixturesProps) => {
  const parts = useMemo(
    () => ({
      marker: boxPart([9, 10, 1.5]),
      apron: boxPart([13, 0.6, 16]),
      ramp: boxPart([12, 14, 1.5]),
      stall: boxPart(placed(layout, state.stalls[0]).size),
    }),
    [layout, state.stalls],
  );
  const items = useMemo(() => {
    const doorItems = state.doors.map((d) => placed(layout, d));
    return {
      markers: state.doors.map((d, i) => ({
        ...atBottom(doorItems[i], d),
        y: 4,
        z: doorItems[i].z - Math.sign(doorItems[i].z) * 6.4,
      })),
      aprons: state.doors.map((d, i) => ({
        ...atBottom(doorItems[i], d),
        y: 0.6,
        z: doorItems[i].z + Math.sign(doorItems[i].z),
      })),
      ramps: state.ramps.map((r) => atBottom(placed(layout, r), r)),
      stalls: state.stalls.map((s) => atBottom(placed(layout, s), s)),
    };
  }, [layout, state]);
  const color = (it: EntityItem) => statusColor(it.entity, palette);
  return (
    <group>
      <InstancedParts
        parts={parts.marker}
        items={items.markers}
        colorOf={color}
        pick={pick}
      />
      <InstancedParts
        parts={parts.apron}
        items={items.aprons}
        colorOf={color}
        pick={pick}
      />
      <InstancedParts
        parts={parts.ramp}
        items={items.ramps}
        colorOf={color}
        pick={pick}
      />
      <InstancedParts
        parts={parts.stall}
        items={items.stalls}
        colorOf={color}
        pick={pick}
      />
    </group>
  );
};
