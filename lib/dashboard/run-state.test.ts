import { describe, expect, it } from "vitest";
import { Run } from "@/lib/run/run";
import { ScriptedDeliberator } from "@/lib/run/scripted-deliberator";
import type { RunSnapshot, StepResult } from "@/types/run";
import type { RunResponse } from "./run-client";
import {
  afterBusyResync,
  beginRequest,
  canStep,
  disruptionResponse,
  INITIAL_RUN_STATE,
  type RunRequestKind,
  type RunState,
  settleRequest,
} from "./run-state";

const makeRun = (): Run =>
  new Run({
    runId: "run-state-test",
    mode: "live",
    deliberator: new ScriptedDeliberator({}),
    fallbackDeliberator: new ScriptedDeliberator({}),
    tierFor: () => "super",
  });

const snapshot = (): RunSnapshot => makeRun().snapshot();

const begin = (s: RunState, kind: RunRequestKind): RunState => {
  const res = beginRequest(s, kind);
  if ("dropped" in res) throw new Error(`dropped: ${res.dropped.error}`);
  return res.state;
};

const run = (
  s: RunState,
  kind: RunRequestKind,
  res: RunResponse<RunSnapshot>,
): RunState => settleRequest(begin(s, kind), kind, res);

const live = (): RunState =>
  run(INITIAL_RUN_STATE, "start", { status: "ready", data: snapshot() });

describe("run state", () => {
  it("start loads, then a live run is steppable", () => {
    const loading = begin(INITIAL_RUN_STATE, "start");
    expect(loading.status).toBe("loading");
    expect(canStep(loading)).toBe(false);
    const ready = settleRequest(loading, "start", {
      status: "ready",
      data: snapshot(),
    });
    expect(ready.runId).toBe("run-state-test");
    expect(canStep(ready)).toBe(true);
  });

  it("drops a second request while one is in flight, and says so", () => {
    const inFlight = begin(live(), "step");
    expect(canStep(inFlight)).toBe(false);
    const second = beginRequest(inFlight, "disrupt");
    expect(second).toEqual({
      dropped: {
        status: "ready",
        snapshot: inFlight.snapshot,
        error: "REQUEST_IN_FLIGHT",
      },
    });
  });

  it("refuses step without a run with NO_RUN", () => {
    const res = beginRequest(INITIAL_RUN_STATE, "step");
    expect("dropped" in res && res.dropped.error).toBe("NO_RUN");
  });

  it("a 404 from the run sets missing, clears the run and disables Step", () => {
    const before = live();
    const after = run(before, "step", {
      status: "missing",
      error: "RUN_NOT_FOUND",
    });
    expect(after.status).toBe("missing");
    expect(after.runId).toBeNull();
    expect(after.snapshot).toBe(before.snapshot);
    expect(canStep(after)).toBe(false);
  });

  it("a transient error keeps the run steppable", () => {
    const after = run(live(), "step", { status: "error", error: "HTTP_500" });
    expect(after.status).toBe("error");
    expect(after.error).toBe("HTTP_500");
    expect(after.runId).toBe("run-state-test");
    expect(canStep(after)).toBe(true);
  });

  it("RUN_BUSY shows the resynced snapshot but keeps the refusal", () => {
    const resynced = snapshot();
    const after = run(
      live(),
      "disrupt",
      afterBusyResync({ status: "ready", data: resynced }),
    );
    expect(after.snapshot).toBe(resynced);
    expect(after.error).toBe("RUN_BUSY");
    expect(canStep(after)).toBe(true);
  });

  it("replay has no server run, so Step stays disabled", () => {
    const after = run(live(), "replay", { status: "ready", data: snapshot() });
    expect(after.runId).toBeNull();
    expect(canStep(after)).toBe(false);
  });

  it("a missing recording keeps the live run", () => {
    const after = run(live(), "replay", {
      status: "error",
      error: "RECORDING_NOT_FOUND",
    });
    expect(after.runId).toBe("run-state-test");
    expect(canStep(after)).toBe(true);
  });

  it("a refused disruption is an error with the engine reasonCode", () => {
    const r = makeRun();
    const result: StepResult = r.injectDisruption({
      type: "dock_closure",
      targetId: "D-999",
    });
    const res = disruptionResponse({ status: "ready", data: result });
    expect(res.error).toBe("DISRUPTION_REFUSED: NOT_FOUND");
    expect(res.data).toEqual(result.snapshot);

    const applied = makeRun().injectDisruption({
      type: "dock_closure",
      targetId: "D-108",
    });
    expect(
      disruptionResponse({ status: "ready", data: applied }).error,
    ).toBeUndefined();
  });
});
