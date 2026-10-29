// What the scene shows and how the camera behaves. Appearance only; none of it
// reaches the engine. Pure; no React or three.js.
import type { AmbientMotion } from "./ambient-motion";
import type { SceneState } from "./types";

export interface ViewSettings {
  roof: boolean;
  models: boolean;
  lens: boolean;
  /** Tilt-shift blur strength, 0 (none) to 1 (full). */
  lensStrength: number;
  shadows: boolean;
  /** Illustrative decorative motion. */
  ambient: boolean;
  topDown: boolean;
}

export const DEFAULT_VIEW: ViewSettings = {
  roof: true,
  models: true,
  lens: true,
  lensStrength: 1,
  shadows: true,
  ambient: true,
  topDown: false,
};

/** Trucks (trailers and tractors) that move, in id order: what `[` and `]` cycle through. */
export const followableIds = (
  state: SceneState,
  motion: AmbientMotion,
): string[] =>
  [...state.trailers, ...state.tractors]
    .map((e) => e.id)
    .filter((id) => motion.ids.has(id))
    .sort();

/** The next (step 1) or previous (step -1) id, wrapping; the first or last when `current` is not in the list. */
export const cycleId = (
  ids: readonly string[],
  current: string | null,
  step: 1 | -1,
): string | null => {
  if (ids.length === 0) return null;
  const at = current === null ? -1 : ids.indexOf(current);
  if (at === -1) return step > 0 ? ids[0] : ids[ids.length - 1];
  return ids[(at + step + ids.length) % ids.length];
};

/**
 * The truck to follow after the selection changes: the same one while the
 * selection is the followed truck, the new one when another truck is picked
 * (like `[` and `]`), and none otherwise.
 */
export const followAfterSelect = (
  followId: string | null,
  selectedId: string | null,
  selectedIsTruck: boolean,
): string | null => {
  if (followId === null || selectedId === followId) return followId;
  return selectedId !== null && selectedIsTruck ? selectedId : null;
};
