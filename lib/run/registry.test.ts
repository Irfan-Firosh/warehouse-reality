import { describe, expect, it, vi } from "vitest";
import { createRun, getRun } from "./registry";

const BODY = { scenarioId: "d108", mode: "live" } as const;

describe("run registry", () => {
  it("getRun of an unknown id is undefined", () => {
    expect(getRun("no-such-run")).toBeUndefined();
  });

  it("concurrent step on a busy run is refused", async () => {
    const run = createRun(BODY);
    const first = run.step(1);
    expect(run.busy).toBe(true);
    await expect(run.step(1)).rejects.toThrow("RUN_BUSY");
    await first;
    expect(run.busy).toBe(false);
  });

  it("registry keeps at most 20 runs, evicting the oldest", () => {
    const ids = Array.from(
      { length: 21 },
      () => createRun(BODY).snapshot().runId,
    );
    expect(getRun(ids[0] as string)).toBeUndefined();
    for (const id of ids.slice(1)) expect(getRun(id)).toBeDefined();
  });

  it("never evicts a busy run", () => {
    const busy = createRun(BODY);
    vi.spyOn(busy, "busy", "get").mockReturnValue(true);
    const ids = Array.from(
      { length: 20 },
      () => createRun(BODY).snapshot().runId,
    );
    expect(getRun(busy.snapshot().runId)).toBe(busy);
    expect(getRun(ids[0] as string)).toBeUndefined();
  });

  it("seeds each run with the D-108 scenario in idle status", () => {
    const snap = createRun(BODY).snapshot();
    expect(snap.status).toBe("idle");
    expect(snap.scenarioId).toBe("d108");
  });
});
