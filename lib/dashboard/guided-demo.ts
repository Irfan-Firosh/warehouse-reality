/**
 * The guided D-108 flow (plan B5), without React: start a live run, close
 * D-108, then step one agent turn at a time until the run reports done. Every
 * branch reads the action's own RunActionResult, never hook state from an
 * earlier render, and reports one status line per action so the UI can show
 * what happened. An AbortSignal stops it between actions and during waits.
 */

import type { CreateRunBody, DisruptionBody } from "@/lib/run/api-schemas";
import type { RunSnapshot } from "@/types/run";
import { NETWORK_ERROR } from "./run-client";
import type { RunActionResult } from "./run-state";

export const GUIDED_DISRUPTION: DisruptionBody = {
  type: "dock_closure",
  targetId: "D-108",
};

/** One agent turn per request, so a live Nemotron step stays short. */
export const GUIDED_TURNS_PER_STEP = 1;
/** Upper bound on step requests (the run's call cap), so a run that never reports done still ends. */
export const MAX_GUIDED_STEPS = 60;
/** How long one action keeps retrying while the run is busy or a reply was lost. */
export const MAX_WAIT_MS = 90_000;
export const FIRST_RETRY_MS = 500;
export const MAX_RETRY_MS = 8_000;

/** Someone else holds the run (another request, or the server still deliberating). */
const BUSY: ReadonlySet<string> = new Set(["REQUEST_IN_FLIGHT", "RUN_BUSY"]);
/** The reply was lost; the server may still be working on the step. */
const LOST_REPLY: ReadonlySet<string> = new Set([
  "HTTP_502",
  "HTTP_503",
  "HTTP_504",
]);

export const isLostReply = (code: string): boolean =>
  LOST_REPLY.has(code) || code.startsWith(NETWORK_ERROR);

export interface GuidedApi {
  start(mode: CreateRunBody["mode"]): Promise<RunActionResult>;
  disrupt(body: DisruptionBody): Promise<RunActionResult>;
  step(maxTurns: number): Promise<RunActionResult>;
}

export type GuidedTone = "progress" | "done" | "error";

export interface GuidedLine {
  tone: GuidedTone;
  text: string;
}

export type GuidedOutcome = "done" | "failed" | "stalled" | "stopped";

export interface GuidedDeps {
  report: (line: GuidedLine) => void;
  wait?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** Milliseconds; injectable so tests can run the retry window instantly. */
  now?: () => number;
  signal?: AbortSignal;
}

const defaultWait = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal?.addEventListener("abort", finish, { once: true });
  });

const plural = (n: number, word: string): string =>
  `${n} ${word}${n === 1 ? "" : "s"}`;

const seconds = (ms: number): string => `${Math.round(ms / 100) / 10} s`;

/** One status line for a finished step, from the step's own snapshot. */
export const stepLine = (
  stepNo: number,
  snapshot: RunSnapshot,
  newEvents: number,
): string =>
  `Step ${stepNo}: ${plural(newEvents, "new event")}, ` +
  `${plural(snapshot.modelCalls.length, "model call")} so far, run ${snapshot.status}`;

/** Why a result ends the flow, or undefined when it can continue. */
export const failureOf = (r: RunActionResult): string | undefined => {
  if (r.error) return r.error;
  if (r.status === "missing") return "RUN_NOT_FOUND";
  if (r.status === "error") return "RUN_ERROR";
  if (!r.snapshot) return "NO_SNAPSHOT";
  if (r.snapshot.status === "error") return "RUN_ERROR";
  return undefined;
};

const ADVICE: Readonly<Record<string, string>> = {
  RUN_NOT_FOUND:
    "the server no longer has this run (restarted?); run the scenario again",
  RUN_ERROR: "the server reported a run error",
};

const failureText = (action: string, code: string): string => {
  const advice = ADVICE[code];
  return `${action} failed: ${code}${advice ? ` (${advice})` : ""}`;
};

const STOPPED = Symbol("stopped");
type Attempt = RunActionResult | typeof STOPPED;

const retryReason = (r: RunActionResult, code: string): string =>
  r.snapshot?.status === "deliberating"
    ? `${code}, the server is still deliberating`
    : code;

/**
 * Runs one action, then re-sends it with backoff while the run is busy (or,
 * for steps, while replies are lost), for at most MAX_WAIT_MS. Re-sending a
 * step after a lost reply is safe: the server answers RUN_BUSY until that
 * turn ends, then steps the next one.
 */
const persist = async (
  label: string,
  act: () => Promise<RunActionResult>,
  retryLost: boolean,
  { report, wait = defaultWait, now = Date.now, signal }: GuidedDeps,
): Promise<Attempt> => {
  const deadline = now() + MAX_WAIT_MS;
  let delay = FIRST_RETRY_MS;
  let result = await act();
  while (result.error) {
    const code = result.error;
    const retryable = BUSY.has(code) || (retryLost && isLostReply(code));
    if (!retryable || now() + delay > deadline) return result;
    if (signal?.aborted) return STOPPED;
    report({
      tone: "progress",
      text: `${label}: ${retryReason(result, code)}; retrying in ${seconds(delay)}`,
    });
    await wait(delay, signal);
    if (signal?.aborted) return STOPPED;
    delay = Math.min(delay * 2, MAX_RETRY_MS);
    result = await act();
  }
  return result;
};

const stopLine: GuidedLine = {
  tone: "error",
  text: "Stopped by the presenter; the run keeps its state on the server",
};

/**
 * Drives start → disrupt → step until done. Resolves with how it ended; the
 * last reported line says why.
 */
export const runGuidedDemo = async (
  api: GuidedApi,
  deps: GuidedDeps,
): Promise<GuidedOutcome> => {
  const { report, signal } = deps;
  const stopped = (): GuidedOutcome => {
    report(stopLine);
    return "stopped";
  };
  if (signal?.aborted) return stopped();

  report({ tone: "progress", text: "Starting a live D-108 run…" });
  const started = await persist("Start", () => api.start("live"), false, deps);
  if (started === STOPPED) return stopped();
  const startFailure = failureOf(started);
  if (startFailure) {
    report({ tone: "error", text: failureText("Start", startFailure) });
    return "failed";
  }
  if (signal?.aborted) return stopped();

  const target = GUIDED_DISRUPTION.targetId;
  report({ tone: "progress", text: `Run started. Closing ${target}…` });
  const disrupted = await persist(
    "Disruption",
    () => api.disrupt(GUIDED_DISRUPTION),
    false,
    deps,
  );
  if (disrupted === STOPPED) return stopped();
  const disruptFailure = failureOf(disrupted);
  if (disruptFailure || !disrupted.snapshot) {
    report({
      tone: "error",
      text: failureText("Disruption", disruptFailure ?? "NO_SNAPSHOT"),
    });
    return "failed";
  }

  let events = disrupted.snapshot.events.length;
  report({ tone: "progress", text: `${target} closed. Stepping agents…` });
  for (let n = 1; n <= MAX_GUIDED_STEPS; n++) {
    if (signal?.aborted) return stopped();
    const stepped = await persist(
      `Step ${n}`,
      () => api.step(GUIDED_TURNS_PER_STEP),
      true,
      deps,
    );
    if (stepped === STOPPED) return stopped();
    const failure = failureOf(stepped);
    if (failure || !stepped.snapshot) {
      report({
        tone: "error",
        text: failureText(`Step ${n}`, failure ?? "NO_SNAPSHOT"),
      });
      return "failed";
    }
    const snap = stepped.snapshot;
    const added = snap.events.length - events;
    events = snap.events.length;
    if (snap.status === "done") {
      report({
        tone: "done",
        text: `Done after ${plural(n, "step")}: ${plural(snap.modelCalls.length, "model call")}, ${plural(snap.events.length, "event")}`,
      });
      return "done";
    }
    report({ tone: "progress", text: stepLine(n, snap, added) });
    if (added === 0 && snap.status === "idle") {
      report({
        tone: "error",
        text: `Stopped at step ${n}: the run is idle and no agent has work`,
      });
      return "stalled";
    }
  }
  report({
    tone: "error",
    text: `Stopped after ${MAX_GUIDED_STEPS} steps without the run reporting done`,
  });
  return "stalled";
};
