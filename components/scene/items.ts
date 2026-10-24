import type { Entity, Placement } from "@/lib/scene/types";
import type { InstanceItem } from "./instanced-parts";

export type EntityItem = InstanceItem & { id: string; entity: Entity };

/** Instance transform with the model's bottom at the placement box's bottom. */
export const atBottom = (
  pl: Placement,
  entity: Entity,
  dy = 0,
): EntityItem => ({
  x: pl.x,
  y: pl.y - pl.size[1] / 2 + dy,
  z: pl.z,
  rotY: pl.rotY,
  id: entity.id,
  entity,
});

export const placed = (
  layout: ReadonlyMap<string, Placement>,
  e: Entity,
): Placement => {
  const pl = layout.get(e.id);
  if (!pl) throw new Error(`no placement for ${e.id}`);
  return pl;
};
