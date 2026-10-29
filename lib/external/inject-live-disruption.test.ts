import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as disrupt } from "@/app/api/runs/[runId]/disruptions/route";
import { POST as step } from "@/app/api/runs/[runId]/step/route";
import type { StepResult } from "@/types/run";
import { createRun } from "../run/registry";
import { D108 } from "../run/scenarios/d108";
import { searchFreightDisruptions } from "./tavily-client";
import { toDisruptionBody } from "./to-disruption-body";

const search = vi.fn();
vi.mock("@tavily/core", () => ({ tavily: () => ({ search }) }));
vi.mock("server-only", () => ({}));

const SOURCE = {
  title: "I-35 lane closure in Dallas",
  url: "https://news.example/i35",
};

const post = (body: unknown) =>
  new Request("http://test/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("live scout result injected into a real run", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("records external_search provenance with the source URL and queues the trailer's driver", async () => {
    vi.stubEnv("TAVILY_API_KEY", "tvly-e2e-key");
    search.mockResolvedValue({
      results: [{ ...SOURCE, content: "Traffic backed up", score: 0.9 }],
    });
    const [live] = (await searchFreightDisruptions("e2e i-35")).results;
    if (!live) throw new Error("expected a live result");

    const runId = createRun({ scenarioId: "d108", mode: "baseline" }).snapshot()
      .runId;
    const ctx = { params: Promise.resolve({ runId }) };
    const res = await disrupt(post(toDisruptionBody(live, D108.trailer)), ctx);
    expect(res.status).toBe(200);
    const { newEvents } = (await res.json()) as StepResult;
    expect(newEvents).toContainEqual(
      expect.objectContaining({
        kind: "disruption",
        type: "external_delay",
        affectedIds: [D108.trailer],
        provenance: "external_search",
        sources: [SOURCE],
      }),
    );

    const stepped = (await (
      await step(post({ maxTurns: 2 }), ctx)
    ).json()) as StepResult;
    const actors = stepped.newEvents
      .filter((e) => e.type === "agent_turn")
      .map((e) => e.actorId);
    expect(actors).toContain(D108.driverAgent);
  });
});
