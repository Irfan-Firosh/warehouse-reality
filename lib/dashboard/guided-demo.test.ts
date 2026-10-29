import { describe, expect, it } from "vitest";
import { BaselineDeliberator } from "@/lib/run/baseline-deliberator";
import { Run } from "@/lib/run/run";
import type { RunSnapshot } from "@/types/run";
import {
  GUIDED_TURNS_PER_STEP,
  type GuidedApi,
  type GuidedLine,
  MAX_GUIDED_STEPS,
  MAX_WAIT_MS,
  runGuidedDemo,
} from "./guided-demo";
import type { RunActionResult } from "./run-state";

const newRun = (): Run =>
  new Run({
    runId: "guided-test",
    mode: "baseline",
    deliberator: new BaselineDeliberator(),
    fallbackDeliberator: new BaselineDeliberator(),
    tierFor: () => "super",
  });

const ok = (snapshot: RunSnapshot): RunActionResult => ({
  status: "ready",
  snapshot,
  error: null,
});

/** The hook's contract over an in-process Run: each action resolves to its own result. */
const apiOver = (run: Run): GuidedApi & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    start: async (mode) => {
      calls.push(`start:${mode}`);
      return ok(run.snapshot());
    },
    disrupt: async (body) => {
      calls.push(`disrupt:${body.type}:${body.targetId}`);
      return ok(run.injectDisruption(body).snapshot);
    },
    step: async (maxTurns) => {
      calls.push(`step:${maxTurns}`);
      return ok((await run.step(maxTurns)).snapshot);
    },
  };
};

/** A fake clock: every wait advances it, so retry windows run instantly. */
const collect = () => {
  const lines: GuidedLine[] = [];
  let clock = 0;
  const waits: number[] = [];
  return {
    lines,
    waits,
    elapsed: () => clock,
    deps: {
      report: (l: GuidedLine) => lines.push(l),
      now: () => clock,
      wait: async (ms: number) => {
        waits.push(ms);
        clock += ms;
      },
    },
  };
};

describe("runGuidedDemo", () => {
  it("starts a live run, closes D-108, then steps one turn at a time until done", async () => {
    const run = newRun();
    const api = apiOver(run);
    const { lines, deps } = collect();

    const outcome = await runGuidedDemo(api, deps);

    expect(outcome).toBe("done");
    expect(api.calls.slice(0, 2)).toEqual([
      "start:live",
      "disrupt:dock_closure:D-108",
    ]);
    const steps = api.calls.slice(2);
    expect(steps.length).toBeGreaterThan(0);
    expect(new Set(steps)).toEqual(new Set([`step:${GUIDED_TURNS_PER_STEP}`]));
    expect(GUIDED_TURNS_PER_STEP).toBe(1);
    expect(run.snapshot().status).toBe("done");
    expect(lines.at(-1)?.tone).toBe("done");
    expect(lines.some((l) => l.text.startsWith("Step 1:"))).toBe(true);
  });

  it("stops visibly when the disruption is refused", async () => {
    const run = newRun();
    const api: GuidedApi = {
      ...apiOver(run),
      disrupt: async () => ({
        ...ok(run.snapshot()),
        error: "DISRUPTION_REFUSED: NOT_FOUND",
      }),
    };
    const { lines, deps } = collect();

    expect(await runGuidedDemo(api, deps)).toBe("failed");
    expect(lines.at(-1)).toEqual({
      tone: "error",
      text: "Disruption failed: DISRUPTION_REFUSED: NOT_FOUND",
    });
  });

  it("waits out a RUN_BUSY that lasts tens of seconds, with backoff, then continues", async () => {
    const run = newRun();
    const base = apiOver(run);
    const { lines, waits, elapsed, deps } = collect();
    const busyUntil = 40_000;
    const api: GuidedApi = {
      ...base,
      step: async (maxTurns) => {
        if (elapsed() < busyUntil) {
          return {
            ...ok({ ...run.snapshot(), status: "deliberating" }),
            error: "RUN_BUSY",
          };
        }
        return base.step(maxTurns);
      },
    };

    expect(await runGuidedDemo(api, deps)).toBe("done");
    expect(elapsed()).toBeGreaterThanOrEqual(busyUntil);
    expect(waits[1]).toBeGreaterThan(waits[0] ?? 0);
    expect(
      lines.some((l) =>
        l.text.includes("RUN_BUSY, the server is still deliberating"),
      ),
    ).toBe(true);
  });

  it("gives up on a run that stays busy past the wait window", async () => {
    const run = newRun();
    let attempts = 0;
    const api: GuidedApi = {
      ...apiOver(run),
      start: async () => {
        attempts += 1;
        return { status: "none", snapshot: null, error: "REQUEST_IN_FLIGHT" };
      },
    };
    const { lines, elapsed, deps } = collect();

    expect(await runGuidedDemo(api, deps)).toBe("failed");
    expect(attempts).toBeGreaterThan(3);
    expect(elapsed()).toBeLessThanOrEqual(MAX_WAIT_MS);
    expect(lines.at(-1)?.text).toBe("Start failed: REQUEST_IN_FLIGHT");
  });

  it("keeps going after a step's reply is lost (504) while the server finishes it", async () => {
    const run = newRun();
    const base = apiOver(run);
    let lost = 0;
    let pending: Promise<unknown> | null = null;
    const api: GuidedApi = {
      ...base,
      step: async (maxTurns) => {
        if (pending) {
          // The server is still on the lost step: the next request is refused as busy.
          await pending;
          pending = null;
          return { ...ok(run.snapshot()), error: "RUN_BUSY" };
        }
        if (lost === 0 && run.snapshot().events.length > 0) {
          lost += 1;
          // The proxy gives up, but the server keeps stepping.
          pending = run.step(maxTurns);
          return {
            status: "error",
            snapshot: run.snapshot(),
            error: "HTTP_504",
          };
        }
        return base.step(maxTurns);
      },
    };
    const { lines, deps } = collect();

    expect(await runGuidedDemo(api, deps)).toBe("done");
    expect(lost).toBe(1);
    expect(lines.some((l) => l.text.startsWith("Step 1: HTTP_504"))).toBe(true);
    expect(run.snapshot().status).toBe("done");
  });

  it("does not resend a start whose reply was lost", async () => {
    const run = newRun();
    let attempts = 0;
    const api: GuidedApi = {
      ...apiOver(run),
      start: async () => {
        attempts += 1;
        return {
          status: "error",
          snapshot: null,
          error: "NETWORK_ERROR: offline",
        };
      },
    };
    const { deps } = collect();

    expect(await runGuidedDemo(api, deps)).toBe("failed");
    expect(attempts).toBe(1);
  });

  it("stops between actions once aborted, without stepping", async () => {
    const run = newRun();
    const controller = new AbortController();
    const base = apiOver(run);
    const api: GuidedApi & { calls: string[] } = {
      ...base,
      disrupt: async (body) => {
        const r = await base.disrupt(body);
        controller.abort();
        return r;
      },
    };
    const { lines, deps } = collect();

    const outcome = await runGuidedDemo(api, {
      ...deps,
      signal: controller.signal,
    });

    expect(outcome).toBe("stopped");
    expect(base.calls.some((c) => c.startsWith("step"))).toBe(false);
    expect(lines.at(-1)?.text).toMatch(/^Stopped by the presenter/);
  });

  it("stops during a busy wait once aborted", async () => {
    const run = newRun();
    const controller = new AbortController();
    let steps = 0;
    const api: GuidedApi = {
      ...apiOver(run),
      step: async () => {
        steps += 1;
        return { ...ok(run.snapshot()), error: "RUN_BUSY" };
      },
    };
    const { deps } = collect();

    const outcome = await runGuidedDemo(api, {
      ...deps,
      signal: controller.signal,
      wait: async () => controller.abort(),
    });

    expect(outcome).toBe("stopped");
    expect(steps).toBe(1);
  });

  it("explains a run the server lost (404) instead of looping", async () => {
    const run = newRun();
    const api: GuidedApi = {
      ...apiOver(run),
      step: async () => ({
        status: "missing",
        snapshot: run.snapshot(),
        error: "RUN_NOT_FOUND",
      }),
    };
    const { lines, deps } = collect();

    expect(await runGuidedDemo(api, deps)).toBe("failed");
    expect(lines.at(-1)?.text).toMatch(/^Step 1 failed: RUN_NOT_FOUND \(/);
  });

  it("stops when a step changes nothing and the run stays idle", async () => {
    const run = newRun();
    const api: GuidedApi = {
      ...apiOver(run),
      step: async () => ok(run.snapshot()),
    };
    const { lines, deps } = collect();

    expect(await runGuidedDemo(api, deps)).toBe("stalled");
    expect(lines.at(-1)?.text).toMatch(/idle and no agent has work/);
  });

  it("never steps more than MAX_GUIDED_STEPS times", async () => {
    const run = newRun();
    let steps = 0;
    const api: GuidedApi = {
      ...apiOver(run),
      step: async () => {
        steps += 1;
        const snap = run.snapshot();
        // Always one more event, never done.
        const events = [...snap.events, ...Array(steps).fill(snap.events[0])];
        return ok({ ...snap, status: "idle", events });
      },
    };
    const { deps } = collect();

    expect(await runGuidedDemo(api, deps)).toBe("stalled");
    expect(steps).toBe(MAX_GUIDED_STEPS);
  });
});
