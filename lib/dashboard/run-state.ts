/**
 * Pure state transitions for useRun, so the hook's rules are testable without
 * React: one request at a time, a 404 from /api/runs/:id drops the run, a
 * transient error keeps it steppable, and a replay has no server run.
 */

import type { RunSnapshot, StepResult } from "@/types/run";
import { type RunStatus, refusedDisruptionCode } from "./project-run";
import type { RunResponse } from "./run-client";

export type RunRequestKind =
  | "start"
  | "step"
  | "disrupt"
  | "replay"
  | "refresh";

export interface RunState {
  /** Live server run; null before start, after a 404 and in replay. */
  runId: string | null;
  snapshot: RunSnapshot | null;
  status: RunStatus;
  /** Last server error code or client message; null after a clean success. */
  error: string | null;
  inFlight: boolean;
}

/** What every useRun action resolves to, so a sequential flow can branch. */
export interface RunActionResult {
  status: RunStatus;
  snapshot: RunSnapshot | null;
  /** Includes REQUEST_IN_FLIGHT and NO_RUN for calls that were not sent. */
  error: string | null;
}

export const INITIAL_RUN_STATE: RunState = {
  runId: null,
  snapshot: null,
  status: "none",
  error: null,
  inFlight: false,
};

const NEEDS_RUN: ReadonlySet<RunRequestKind> = new Set([
  "step",
  "disrupt",
  "refresh",
]);
const SHOWS_LOADING: ReadonlySet<RunRequestKind> = new Set(["start", "replay"]);

export const resultOf = (s: RunState): RunActionResult => ({
  status: s.status,
  snapshot: s.snapshot,
  error: s.error,
});

/** Step and disrupt need a live run that is not known to be gone. */
export const canStep = (s: RunState): boolean =>
  !s.inFlight && s.runId !== null && s.status !== "missing";

/** Locks the state for a request, or names why the call was not sent. */
export const beginRequest = (
  s: RunState,
  kind: RunRequestKind,
): { state: RunState } | { dropped: RunActionResult } => {
  if (s.inFlight) {
    return { dropped: { ...resultOf(s), error: "REQUEST_IN_FLIGHT" } };
  }
  if (NEEDS_RUN.has(kind) && s.runId === null) {
    return { dropped: { ...resultOf(s), error: "NO_RUN" } };
  }
  return {
    state: {
      ...s,
      inFlight: true,
      status: SHOWS_LOADING.has(kind) ? "loading" : s.status,
    },
  };
};

const nextRunId = (
  s: RunState,
  kind: RunRequestKind,
  res: RunResponse<RunSnapshot>,
): string | null => {
  if (res.data && kind === "start") return res.data.runId;
  if (res.data && kind === "replay") return null;
  if (res.status === "missing" && NEEDS_RUN.has(kind)) return null;
  return s.runId;
};

export const settleRequest = (
  s: RunState,
  kind: RunRequestKind,
  res: RunResponse<RunSnapshot>,
): RunState => ({
  runId: nextRunId(s, kind, res),
  snapshot: res.data ?? s.snapshot,
  status: res.status,
  error: res.error ?? null,
  inFlight: false,
});

/** RUN_BUSY: show the server's state but keep the refusal visible. */
export const afterBusyResync = (
  resync: RunResponse<RunSnapshot>,
): RunResponse<RunSnapshot> => ({
  ...resync,
  error: resync.error ?? "RUN_BUSY",
});

export const stepResponse = (
  res: RunResponse<StepResult>,
): RunResponse<RunSnapshot> => ({
  status: res.status,
  ...(res.data ? { data: res.data.snapshot } : {}),
  ...(res.error ? { error: res.error } : {}),
});

/** A disruption the engine refused still returns 200; surface it as an error. */
export const disruptionResponse = (
  res: RunResponse<StepResult>,
): RunResponse<RunSnapshot> => {
  const refused = res.data?.newEvents
    .map(refusedDisruptionCode)
    .find((code) => code !== undefined);
  const base = stepResponse(res);
  return refused ? { ...base, error: `DISRUPTION_REFUSED: ${refused}` } : base;
};

const STATUS_LABEL: Readonly<Record<RunStatus, string>> = {
  none: "No run yet",
  loading: "Loading run",
  ready: "Run ready",
  missing: "Run not found",
  error: "Run error",
};

/** What the top bar says about the run, from the hook status, not the clock. */
export const runStatusLabel = (status: RunStatus, busy: boolean): string =>
  busy ? "Run request in flight" : STATUS_LABEL[status];
