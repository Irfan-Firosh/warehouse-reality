import { describe, expect, it } from "vitest";
import type { ModelCall, RunBudget } from "@/types/run";
import {
  budgetMeter,
  callBadgeText,
  callProvenance,
  callsWithoutUsage,
  formatCompact,
  formatLatency,
  formatTokens,
} from "./model-call-format";
import type { RunTimelineEvent } from "./project-run";

const call = (over: Partial<ModelCall> = {}): ModelCall => ({
  id: "MC-1",
  agentId: "DOCK-C",
  role: "dock_lead",
  tier: "super",
  model: "nvidia/nemotron-3-super-120b-a12b",
  isFallback: false,
  latencyMs: 840,
  promptTokens: 1200,
  completionTokens: 85,
  logicalTime: 50400,
  stateVersion: 3,
  outcome: "accepted",
  ...over,
});

const turnEvent = (
  modelCallId: string,
  provenance: RunTimelineEvent["provenance"],
): RunTimelineEvent => ({
  id: "RE-1",
  time: "14:00:00",
  source: "DOCK-C",
  title: "turn",
  type: "action",
  provenance,
  modelCallId,
});

describe("call badge text", () => {
  it("shows model, tier, latency and tokens", () => {
    expect(callBadgeText(call())).toEqual({
      model: "nvidia/nemotron-3-super-120b-a12b",
      tier: "super",
      latency: "840 ms",
      tokens: "1,200 in · 85 out",
    });
  });

  it("keeps unreported usage as unknown, never 0", () => {
    const text = callBadgeText(
      call({ promptTokens: null, completionTokens: null }),
    );
    expect(text.tokens).toBe("unknown in · unknown out");
    expect(formatTokens(null)).toBe("unknown");
    expect(formatTokens(0)).toBe("0");
  });

  it("tags a fallback with its reason", () => {
    expect(
      callBadgeText(call({ isFallback: true, fallbackReason: "timeout" }))
        .fallback,
    ).toBe("timeout");
    expect(callBadgeText(call({ isFallback: true })).fallback).toBe(
      "reason not recorded",
    );
    expect(callBadgeText(call()).fallback).toBeUndefined();
  });

  it("formats latency in ms below a second and s above", () => {
    expect(formatLatency(0)).toBe("0 ms");
    expect(formatLatency(1530)).toBe("1.5 s");
  });
});

describe("callProvenance", () => {
  it("never calls a fallback Nemotron, whatever the event says", () => {
    const c = call({ isFallback: true, fallbackReason: "no_api_key" });
    const view = { timeline: [turnEvent(c.id, "nemotron")] };
    expect(callProvenance(view, c)).toBe("fallback");
  });

  it("uses the timeline label for a clean call", () => {
    const c = call();
    expect(callProvenance({ timeline: [turnEvent(c.id, "replay")] }, c)).toBe(
      "replay",
    );
    expect(callProvenance({ timeline: [turnEvent(c.id, "baseline")] }, c)).toBe(
      "baseline",
    );
  });

  it("does not claim Nemotron for a call with no timeline event", () => {
    expect(callProvenance({ timeline: [] }, call())).not.toBe("nemotron");
  });
});

describe("budget meter", () => {
  const budget = (calls: number, tokens: number): RunBudget => ({
    calls,
    tokens,
    capCalls: 60,
    capTokens: 150000,
    exhausted: false,
  });

  it("reads calls/60 and tokens/150k", () => {
    const m = budgetMeter(budget(12, 3250));
    expect(m.calls.label).toBe("12/60 calls");
    expect(m.calls.ratio).toBeCloseTo(0.2);
    expect(m.tokens.label).toBe("3.3k/150k tokens");
  });

  it("clamps the bar at the cap", () => {
    expect(budgetMeter(budget(61, 0)).calls.ratio).toBe(1);
  });

  it("formats compact counts", () => {
    expect(formatCompact(950)).toBe("950");
    expect(formatCompact(150000)).toBe("150k");
  });

  it("counts calls whose usage was not reported, except baseline turns", () => {
    const calls = [
      call({ id: "MC-1" }),
      call({ id: "MC-2", promptTokens: null }),
      call({ id: "MC-3", completionTokens: null, isFallback: true }),
      call({ id: "MC-4", promptTokens: null, completionTokens: null }),
      // A scripted turn spends budget calls without reporting tokens.
      call({ id: "MC-5", promptTokens: null, completionTokens: null }),
    ];
    const view = {
      timeline: [
        turnEvent("MC-1", "nemotron"),
        turnEvent("MC-2", "nemotron"),
        turnEvent("MC-3", "fallback"),
        // Baseline turns spend no budget, so their missing usage is not unknown spend.
        turnEvent("MC-4", "baseline"),
        turnEvent("MC-5", "replay"),
      ],
    };
    expect(callsWithoutUsage(view, calls)).toBe(3);
  });

  it("never shows a bare token total when some usage is unknown", () => {
    expect(budgetMeter(budget(12, 3250), 2).tokens.label).toBe(
      "≥3.3k/150k tokens · 2 unknown",
    );
    expect(budgetMeter(budget(12, 3250), 0).tokens.label).toBe(
      "3.3k/150k tokens",
    );
  });
});
