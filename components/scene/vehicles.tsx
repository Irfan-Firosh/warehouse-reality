"use client";

import { type RefObject, useMemo } from "react";
import { HALF_D, HALF_L, seeded } from "@/lib/scene/facility";
import { boxPart } from "@/lib/scene/fit-model";
import type { Placement, SceneState } from "@/lib/scene/types";
import {
  InstancedParts,
  type LiveInstances,
  type PickHandlers,
} from "./instanced-parts";
import { atBottom, type EntityItem, placed } from "./items";
import { CHASSIS_H, type Kit, PALLET } from "./model-kit";
import { type ScenePalette, statusColor, WHITE } from "./palette";

const LOAD = boxPart([3.6, 3.4, 3.1]);
const CHASSIS = boxPart([7.5, CHASSIS_H, 50]);

// Staging lanes and pallets are decoration, not cargo records.
export const LANES = Array.from({ length: 28 }, (_, i) => ({
  x: -HALF_L + 80 + Math.floor(i / 2) * 115,
  z: (i % 2 ? 1 : -1) * (HALF_D - 110),
}));
const PALLETS = (() => {
  const rand = seeded(5);
  return LANES.flatMap((lane) =>
    Array.from({ length: 18 }, (_, k) => ({
      x: lane.x - 24 + (k % 3) * 24,
      y: 1.2,
      z: lane.z - 50 + Math.floor(k / 3) * 20,
      rotY: 0,
    })),
  ).filter(() => rand() < 0.6);
})();
const LOADS = PALLETS.map((p) => ({ ...p, y: p.y + PALLET[1] }));

interface VehiclesProps {
  kit: Kit;
  state: SceneState;
  layout: ReadonlyMap<string, Placement>;
  palette: ScenePalette;
  pick: PickHandlers;
  /** Live poses for the entities in `moving`; everything else stays at its layout pose. */
  poses: RefObject<ReadonlyMap<string, Placement>>;
  /** Bumped by the motion clock whenever `poses` changes. */
  version: RefObject<number>;
  moving: ReadonlySet<string>;
}

const liveAt = (
  poses: RefObject<ReadonlyMap<string, Placement>>,
  version: RefObject<number>,
  ids: ReadonlySet<string>,
  dy = 0,
): LiveInstances<EntityItem> => ({
  poses,
  version,
  ids,
  toItem: (pose, item) => atBottom(pose, item.entity, dy),
});

export const Vehicles = ({
  kit,
  state,
  layout,
  palette,
  pick,
  poses,
  version,
  moving,
}: VehiclesProps) => {
  const items = useMemo(() => {
    const trailers = state.trailers.map((t) => atBottom(placed(layout, t), t));
    return {
      chassis: trailers,
      bodies: trailers.map((t) => ({ ...t, y: t.y + CHASSIS_H })),
      tractors: state.tractors.map((t) => atBottom(placed(layout, t), t)),
      forklifts: state.forklifts.map((f) => atBottom(placed(layout, f), f)),
    };
  }, [state, layout]);
  const live = useMemo(
    () => ({
      chassis: liveAt(poses, version, moving),
      bodies: liveAt(poses, version, moving, CHASSIS_H),
    }),
    [poses, version, moving],
  );
  const color = (it: EntityItem) => statusColor(it.entity, palette);
  return (
    <group>
      <InstancedParts
        parts={CHASSIS}
        items={items.chassis}
        colorOf={() => palette.chassis}
        pick={pick}
        live={live.chassis}
      />
      <InstancedParts
        parts={kit.trailerBody}
        items={items.bodies}
        colorOf={color}
        pick={pick}
        live={live.bodies}
      />
      <InstancedParts
        parts={kit.tractor}
        items={items.tractors}
        colorOf={color}
        pick={pick}
        live={live.chassis}
      />
      <InstancedParts
        parts={kit.forklift}
        items={items.forklifts}
        colorOf={color}
        pick={pick}
        live={live.chassis}
      />
      <InstancedParts
        parts={kit.pallet}
        items={PALLETS}
        colorOf={() => WHITE}
      />
      <InstancedParts parts={LOAD} items={LOADS} colorOf={() => palette.load} />
    </group>
  );
};
