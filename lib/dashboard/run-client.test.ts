import { describe, expect, it, vi } from "vitest";
import { BaselineDeliberator } from "@/lib/run/baseline-deliberator";
import { Run } from "@/lib/run/run";
import { ScriptedDeliberator } from "@/lib/run/scripted-deliberator";
import type { RunSnapshot } from "@/types/run";
import {
  createRunRequest,
  type FetchFn,
  replayRequest,
  stepRunRequest,
} from "./run-client";

const realSnapshot = async (): Promise<RunSnapshot> => {
  const run = new Run({
    runId: "run-client-test",
    mode: "live",
    deliberator: new ScriptedDeliberator({}),
    fallbackDeliberator: new ScriptedDeliberator({}),
    tierFor: () => "super",
  });
  run.injectDisruption({ type: "dock_closure", targetId: "D-108" });
  await run.step(8);
  return run.snapshot();
};

/** A baseline run stepped to done: commitments, messages and processed requests. */
const doneSnapshot = async (): Promise<RunSnapshot> => {
  const run = new Run({
    runId: "run-client-done",
    mode: "baseline",
    deliberator: new BaselineDeliberator(),
    fallbackDeliberator: new BaselineDeliberator(),
    tierFor: () => "super",
  });
  run.injectDisruption({ type: "dock_closure", targetId: "D-108" });
  for (let i = 0; i < 10 && run.snapshot().status !== "done"; i++) {
    await run.step(8);
  }
  return run.snapshot();
};

const respond =
  (body: unknown, status = 200): FetchFn =>
  async () =>
    Response.json(body, { status });

describe("run client", () => {
  it('a 404 RUN_NOT_FOUND from step sets status "missing"', async () => {
    const res = await stepRunRequest(
      respond({ error: "RUN_NOT_FOUND" }, 404),
      "gone",
    );
    expect(res).toEqual({ status: "missing", error: "RUN_NOT_FOUND" });
  });

  it("a 409 RUN_BUSY keeps the run ready and returns no data", async () => {
    const res = await stepRunRequest(respond({ error: "RUN_BUSY" }, 409), "r");
    expect(res).toEqual({ status: "ready", error: "RUN_BUSY" });
  });

  it("validates a real engine snapshot and keeps null tokens null", async () => {
    const snap = await realSnapshot();
    expect(snap.modelCalls.length).toBeGreaterThan(0);
    const res = await replayRequest(
      respond(JSON.parse(JSON.stringify(snap))),
      "/runs/x.json",
    );
    expect(res.status).toBe("ready");
    expect(res.data).toEqual(snap);
    expect(res.data?.modelCalls.every((c) => c.promptTokens === null)).toBe(
      true,
    );
  });

  it("validates a baseline run stepped to done", async () => {
    const snap = await doneSnapshot();
    expect(snap.status).toBe("done");
    expect(snap.engine.state.commitments.length).toBeGreaterThan(0);
    expect(snap.engine.processed.length).toBeGreaterThan(0);
    expect(snap.agents.some((a) => a.inbox.length > 0)).toBe(true);
    expect(snap.events.some((e) => e.kind === "message")).toBe(true);
    const res = await replayRequest(
      respond(JSON.parse(JSON.stringify(snap))),
      "/runs/x.json",
    );
    expect(res.error).toBeUndefined();
    expect(res.data).toEqual(snap);
  });

  it("rejects a replay file whose tokens were coerced away, naming the path", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const snap = JSON.parse(JSON.stringify(await realSnapshot()));
    snap.modelCalls[0].promptTokens = "0";
    const res = await replayRequest(respond(snap), "/runs/x.json");
    expect(res.status).toBe("error");
    expect(res.error).toBe("INVALID_SNAPSHOT: modelCalls.0.promptTokens");
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining("/runs/x.json"),
      expect.arrayContaining([
        expect.objectContaining({ path: ["modelCalls", 0, "promptTokens"] }),
      ]),
    );
    logged.mockRestore();
  });

  it("a missing recording is RECORDING_NOT_FOUND, not a missing run", async () => {
    const res = await replayRequest(respond({}, 404), "/runs/gone.json");
    expect(res).toEqual({ status: "error", error: "RECORDING_NOT_FOUND" });
  });

  it("a network failure is an error, not a crash", async () => {
    const res = await replayRequest(async () => {
      throw new Error("offline");
    }, "/runs/x.json");
    expect(res).toEqual({ status: "error", error: "offline" });
  });

  it("creates a d108 run through /api/runs only", async () => {
    const fetchFn = vi.fn<FetchFn>(respond(await realSnapshot()));
    await createRunRequest(fetchFn, "baseline");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe("/api/runs");
    expect(JSON.parse(String(init?.body))).toEqual({
      scenarioId: "d108",
      mode: "baseline",
    });
  });
});
