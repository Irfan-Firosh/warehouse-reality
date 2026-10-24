import type { Entity, SceneState } from "./types";

const EXCEPTION_STATUSES: ReadonlySet<string> = new Set([
  "closed",
  "reserved",
  "blocked",
  "failed",
  "moving",
]);

export interface ExceptionOption {
  id: string;
  label: string;
}

const exceptionStatus = (e: Entity): string | undefined =>
  "status" in e && EXCEPTION_STATUSES.has(e.status) ? e.status : undefined;

/** Entities in an exception state, as a short keyboard-selectable list. */
export const exceptionOptions = (state: SceneState): ExceptionOption[] =>
  [
    ...state.doors,
    ...state.trailers,
    ...state.tractors,
    ...state.forklifts,
  ].flatMap((e) => {
    const status = exceptionStatus(e);
    return status ? [{ id: e.id, label: `${e.id} · ${status}` }] : [];
  });
