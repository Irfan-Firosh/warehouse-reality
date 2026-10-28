import { describe, expect, it, vi } from "vitest";
import { createRun, getRun } from "@/lib/run/registry";
import type { Run } from "@/lib/run/run";
import { POST as disrupt } from "./[runId]/disruptions/route";
import { GET as snapshot } from "./[runId]/route";
import { POST as step } from "./[runId]/step/route";
import { POST as create } from "./route";

const post = (body: string) =>
  new Request("http://test/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
const ctx = (runId: string) => ({ params: Promise.resolve({ runId }) });
const newRunId = () =>
  createRun({ scenarioId: "d108", mode: "live" }).snapshot().runId;

describe("/api/runs routes", () => {
  it("POST creates an idle snapshot", async () => {
    const res = await create(post('{"scenarioId":"d108","mode":"live"}'));
    expect(res.status).toBe(200);
    const snap = await res.json();
    expect(snap.status).toBe("idle");
    const got = await snapshot(new Request("http://test"), ctx(snap.runId));
    expect(got.status).toBe(200);
  });

  it("create rejects invalid and malformed bodies with 400", async () => {
    for (const body of ['{"mode":"x"}', "{not json"]) {
      const res = await create(post(body));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("INVALID_BODY");
    }
  });

  it("unknown run id is 404 RUN_NOT_FOUND on every route", async () => {
    const c = ctx("nope");
    const responses = [
      await snapshot(new Request("http://test"), c),
      await step(post("{}"), c),
      await disrupt(post('{"type":"dock_closure","targetId":"D-108"}'), c),
    ];
    for (const res of responses) {
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "RUN_NOT_FOUND" });
    }
  });

  it("step on a busy run is 409 RUN_BUSY", async () => {
    const runId = newRunId();
    const run = getRun(runId) as Run;
    const busy = vi.spyOn(run, "busy", "get").mockReturnValue(true);
    const res = await step(post("{}"), ctx(runId));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "RUN_BUSY" });
    busy.mockRestore();
  });

  it("a RUN_BUSY throw from the run is also 409", async () => {
    const runId = newRunId();
    const run = getRun(runId) as Run;
    vi.spyOn(run, "step").mockRejectedValue(new Error("RUN_BUSY"));
    vi.spyOn(run, "injectDisruption").mockImplementation(() => {
      throw new Error("RUN_BUSY");
    });
    const s = await step(post("{}"), ctx(runId));
    const d = await disrupt(
      post('{"type":"dock_closure","targetId":"D-108"}'),
      ctx(runId),
    );
    expect([s.status, d.status]).toEqual([409, 409]);
  });

  it("step and disruption return a StepResult; bad bodies are 400", async () => {
    const runId = newRunId();
    const d = await disrupt(
      post('{"type":"dock_closure","targetId":"D-108"}'),
      ctx(runId),
    );
    expect(d.status).toBe(200);
    expect((await d.json()).newEvents.length).toBeGreaterThan(0);
    const s = await step(post("{}"), ctx(runId));
    expect(s.status).toBe(200);
    expect((await s.json()).snapshot.runId).toBe(runId);
    for (const r of [
      await step(post('{"maxTurns":99}'), ctx(runId)),
      await disrupt(post("{}"), ctx(runId)),
    ]) {
      expect(r.status).toBe(400);
      expect((await r.json()).error).toBe("INVALID_BODY");
    }
  });
});
