import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ModelCall,
  Provenance,
  RunEvent,
  RunSnapshot,
} from "../../types/run";
import { SimulationEngine } from "../engine/engine";
import { BaselineDeliberator } from "./baseline-deliberator";
import { computeMetrics } from "./metrics";
import { createRun } from "./registry";
import { D108 } from "./scenarios/d108";

afterEach(() => {
  vi.unstubAllGlobals();
});

const runBaselineToDone = async () => {
  const run = createRun({ scenarioId: "d108", mode: "baseline" });
  run.injectDisruption({ type: "dock_closure", targetId: D108.closedDock });
  for (let i = 0; i < 12 && run.snapshot().status !== "done"; i++) {
    await run.step(8);
  }
  return run.snapshot();
};

// SYNTHETIC: hand-built snapshots that exercise metric arithmetic only; they
// describe no facility and no scenario outcome.
const syntheticCall = (
  id: string,
  over: Partial<ModelCall> = {},
): ModelCall => ({
  id,
  agentId: "SYN-AGENT",
  role: "dock_lead",
  tier: "super",
  model: "synthetic-model",
  isFallback: false,
  latencyMs: 1,
  promptTokens: 10,
  completionTokens: 5,
  logicalTime: 100,
  stateVersion: 1,
  outcome: "accepted",
  ...over,
});

const syntheticEvent = (
  seq: number,
  over: Partial<RunEvent> = {},
): RunEvent => ({
  seq,
  logicalTime: 100,
  stateVersion: 1,
  kind: "engine",
  type: "synthetic",
  affectedIds: [],
  summary: "synthetic",
  provenance: "engine",
  ...over,
});

const turnEvent = (
  seq: number,
  callId: string,
  provenance: Provenance,
): RunEvent =>
  syntheticEvent(seq, {
    kind: "model_call",
    type: "agent_turn",
    causationId: callId,
    provenance,
  });

const syntheticSnapshot = (over: Partial<RunSnapshot> = {}): RunSnapshot => ({
  runId: "SYN-RUN",
  mode: "live",
  scenarioId: "d108",
  status: "done",
  logicalTime: 100,
  stateVersion: 1,
  engine: new SimulationEngine().createCheckpoint(),
  agents: [],
  events: [],
  modelCalls: [],
  budget: {
    calls: 0,
    tokens: 0,
    capCalls: 60,
    capTokens: 150000,
    exhausted: false,
  },
  ...over,
});

describe("baseline run", () => {
  it("baseline completes the D-108 relocation with zero model calls", async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("baseline must not use the network");
    });
    vi.stubGlobal("fetch", fetchSpy);

    const snap = await runBaselineToDone();

    expect(snap.status).toBe("done");
    const trailer = snap.engine.state.trailers.find(
      ([id]) => id === D108.trailer,
    )?.[1];
    expect(trailer?.location).toEqual({
      kind: "dock",
      dockId: D108.targetDock,
    });
    const shipment = snap.engine.state.shipments.find(
      ([id]) => id === D108.shipment,
    )?.[1];
    expect(shipment?.transferredQuantity).toBe(shipment?.totalQuantity);
    expect(snap.modelCalls.length).toBeGreaterThan(0);
    expect(snap.modelCalls.every((c) => c.outcome !== "rejected")).toBe(true);
    expect(snap.events.some((e) => e.provenance === "nemotron")).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();

    const metrics = computeMetrics(snap);
    expect(metrics.modelCalls).toBe(0);
    expect(metrics.tokens).toBe(0);
    expect(metrics.invalidProposals).toBe(0);
  });
});

describe("computeMetrics", () => {
  it("metrics on identical inputs are deterministic", async () => {
    const first = computeMetrics(await runBaselineToDone());
    const second = computeMetrics(await runBaselineToDone());
    expect(second).toEqual(first);
  });

  it('lateness is "unknown" without a target', async () => {
    expect(computeMetrics(await runBaselineToDone()).departureLatenessSec).toBe(
      "unknown",
    );
    expect(computeMetrics(syntheticSnapshot()).departureLatenessSec).toBe(
      "unknown",
    );
  });

  it("invalidProposals counts rejected outcomes only", () => {
    const snap = syntheticSnapshot({
      modelCalls: [
        syntheticCall("MC-1", { outcome: "rejected" }),
        syntheticCall("MC-2", { outcome: "accepted" }),
        syntheticCall("MC-3", { outcome: "no_tool" }),
        syntheticCall("MC-4", { outcome: "rejected", isFallback: true }),
      ],
    });
    expect(computeMetrics(snap).invalidProposals).toBe(2);
  });

  it("counts only real model calls and sums their tokens", () => {
    const snap = syntheticSnapshot({
      modelCalls: [
        syntheticCall("MC-1"),
        syntheticCall("MC-2", { promptTokens: 20, completionTokens: 1 }),
        syntheticCall("MC-3", { model: "baseline-fcfs" }),
        syntheticCall("MC-4", { isFallback: true }),
        syntheticCall("MC-5"),
      ],
      events: [
        turnEvent(1, "MC-1", "nemotron"),
        turnEvent(2, "MC-2", "nemotron"),
        turnEvent(3, "MC-3", "baseline"),
        turnEvent(4, "MC-4", "fallback"),
        turnEvent(5, "MC-5", "replay"),
      ],
    });
    const metrics = computeMetrics(snap);
    expect(metrics.modelCalls).toBe(2);
    expect(metrics.tokens).toBe(36);
  });

  it('tokens are "unknown" when a counted call has null usage', () => {
    const snap = syntheticSnapshot({
      modelCalls: [
        syntheticCall("MC-1"),
        syntheticCall("MC-2", { promptTokens: 7, completionTokens: null }),
      ],
      events: [
        turnEvent(1, "MC-1", "nemotron"),
        turnEvent(2, "MC-2", "nemotron"),
      ],
    });
    const metrics = computeMetrics(snap);
    expect(metrics.modelCalls).toBe(2);
    expect(metrics.tokens).toBe("unknown");
  });

  it('door and driver waiting are "unknown" when no logical time elapsed', async () => {
    const metrics = computeMetrics(await runBaselineToDone());
    expect(metrics.doorHoursLost).toBe("unknown");
    expect(metrics.driverWaitingSec).toBe("unknown");
  });

  it("door hours lost sums closed-door time to the end of the run", () => {
    const snap = syntheticSnapshot({
      logicalTime: 100 + 5400,
      events: [
        syntheticEvent(1, { logicalTime: 100 }),
        syntheticEvent(2, {
          logicalTime: 100,
          type: "dock_closed_disruption",
          affectedIds: ["D-001"],
        }),
      ],
    });
    const closed = snap.engine.state.docks.find(([id]) => id === "D-001");
    if (closed) closed[1].status = "closed";
    expect(computeMetrics(snap).doorHoursLost).toBe(1.5);
  });

  it("driver waiting is measured for a trailer still stuck at a closed dock", () => {
    const engine = new SimulationEngine();
    engine.addTrailer({
      id: "T-SYN-01",
      location: { kind: "dock", dockId: "D-001" },
      cargo: [],
      doorOpen: true,
      status: "serving",
    });
    engine.injectDisruption("H-SYN", "dock_closure", "D-001");
    const snap = syntheticSnapshot({
      logicalTime: 100 + 600,
      engine: engine.createCheckpoint(),
      agents: [
        {
          id: "DRV-SYN",
          role: "driver",
          name: "Synthetic driver",
          assignedEntityId: "T-SYN-01",
          goals: [],
          obligations: [],
          inbox: [],
          outbox: [],
          memory: [],
          fallbackCounter: 0,
        },
      ],
      events: [
        syntheticEvent(1, { logicalTime: 100 }),
        syntheticEvent(2, {
          logicalTime: 100,
          type: "dock_closed_disruption",
          affectedIds: ["D-001"],
        }),
      ],
    });
    expect(computeMetrics(snap).driverWaitingSec).toBe(600);
  });
});

describe("baseline yard", () => {
  // SYNTHETIC: ids describe no facility; they only exercise the tow rule.
  const message = (
    id: string,
    purpose: "offer" | "status_update",
    payload: Record<string, unknown>,
  ) => ({
    id,
    fromAgentId: "YARD-SYN",
    toAgentId: "DRV-SYN",
    purpose,
    payload,
    sentAt: 100,
  });

  it("tows a second trailer after an earlier tow was already moved", async () => {
    const decision = await new BaselineDeliberator().decide({
      agent: {
        id: "YARD-SYN",
        role: "yard_controller",
        name: "Synthetic yard",
        assignedEntityId: "YT-SYN",
        goals: [],
        obligations: [],
        inbox: [],
        outbox: [
          message("M-1", "offer", {
            commitmentId: "C-TOW-OLD",
            task: "Tow T-SYN-OLD to D-SYN-1 with YT-SYN",
          }),
          message("M-2", "status_update", {
            trailerId: "T-SYN-OLD",
            status: "moved",
          }),
          message("M-3", "offer", {
            commitmentId: "C-TOW-NEW",
            task: "Tow T-SYN-NEW to D-SYN-2 with YT-SYN",
          }),
        ],
        memory: [],
        fallbackCounter: 0,
      },
      tier: "super",
      observation: {
        tractors: [{ id: "YT-SYN", assignedCommitmentId: "C-TOW-NEW" }],
      },
      inbox: [],
      stateVersion: 1,
      logicalTime: 100,
    });
    expect(decision.toolCall).toEqual({
      tool: "executeMove",
      parameters: {
        trailerId: "T-SYN-NEW",
        targetLocation: { kind: "dock", dockId: "D-SYN-2" },
        tractorId: "YT-SYN",
      },
    });
  });
});
