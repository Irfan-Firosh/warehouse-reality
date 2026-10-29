import { describe, expect, it, vi } from "vitest";
import type {
  Deliberator,
  ModelTier,
  TurnDecision,
  TurnInput,
} from "../../types/run";
import type { AgentRole, AgentToolCall } from "../agents/types";
import { Run } from "./run";
import { D108 } from "./scenarios/d108";
import { ScriptedDeliberator } from "./scripted-deliberator";

const T0 = 50400; // scenario start 14:00:00
const WINDOW = { startWindow: T0 + 600, endWindow: T0 + 3300 };
const EXPIRES = T0 + 900;

const TIERS: Record<AgentRole, ModelTier> = {
  driver: "nano",
  dock_lead: "super",
  yard_controller: "super",
  supervisor: "ultra",
};

const placeholderCall = (): TurnDecision["call"] => ({
  agentId: "placeholder",
  role: "driver",
  tier: "nano",
  model: "scripted-model",
  isFallback: false,
  latencyMs: 1,
  promptTokens: null,
  completionTokens: null,
  logicalTime: 0,
  stateVersion: 0,
});

const act = (
  tool: AgentToolCall["tool"],
  parameters: Record<string, unknown>,
): TurnDecision => ({
  thought: `scripted ${tool}`,
  toolCall: { tool, parameters },
  call: placeholderCall(),
});
const wait = (): TurnDecision => ({
  thought: "waiting",
  call: placeholderCall(),
});

const propose = (
  task: string,
  resources: { resourceId: string; type: string }[],
  participants: { agentId: string; role: string }[],
) =>
  act("propose", {
    task,
    requiredResources: resources.map((r) => ({ ...r, ...WINDOW })),
    expiresAt: EXPIRES,
    participants,
  });
const accept = (participantId: string, commitmentId: string, v: number) =>
  act("accept", { participantId, commitmentId, acceptedAtVersion: v });
const commit = (commitmentId: string, requestId: string) =>
  act("commit", { commitmentId, requestId });

const makeRun = (
  decisions: Record<string, TurnDecision[]>,
  opts: {
    fallback?: Record<string, TurnDecision[]>;
    initialBudget?: { calls?: number; tokens?: number };
    tierFor?: (role: AgentRole) => ModelTier;
  } = {},
) =>
  new Run({
    runId: "run-test",
    mode: "live",
    deliberator: new ScriptedDeliberator(decisions),
    fallbackDeliberator: new ScriptedDeliberator(opts.fallback ?? {}),
    tierFor: opts.tierFor ?? ((role) => TIERS[role]),
    initialBudget: opts.initialBudget,
  });

const closeD108 = (run: Run) =>
  run.injectDisruption({ type: "dock_closure", targetId: D108.closedDock });

const runToDone = async (run: Run) => {
  for (let i = 0; i < 10 && run.snapshot().status !== "done"; i++) {
    await run.step(8);
  }
};

describe("Run", () => {
  it("D-108 loop: closure → offer D-112 → driver accepts → yard commits YT-2 → move executes → unload resumes from 9", async () => {
    const run = makeRun({
      "DOCK-C": [
        propose(
          "Relocate T-2291 to D-112",
          [{ resourceId: "D-112", type: "dock" }],
          [
            { agentId: "DOCK-C", role: "dock_lead" },
            { agentId: "DRV-047", role: "driver" },
            { agentId: "YARD-1", role: "yard_controller" },
          ],
        ),
        accept("DOCK-C", "C-1", 2),
        commit("C-1", "REQ-1"),
        wait(),
        act("executeUnload", {
          trailerId: "T-2291",
          shipmentId: "SH-5512",
          quantity: 13,
        }),
      ],
      "DRV-047": [accept("DRV-047", "C-1", 2)],
      "YARD-1": [
        accept("YARD-1", "C-1", 2),
        propose(
          "Tow T-2291 with YT-2",
          [{ resourceId: "YT-2", type: "tractor" }],
          [{ agentId: "YARD-1", role: "yard_controller" }],
        ),
        accept("YARD-1", "C-2", 3),
        commit("C-2", "REQ-2"),
        act("executeMove", {
          trailerId: "T-2291",
          targetLocation: { kind: "dock", dockId: "D-112" },
          tractorId: "YT-2",
        }),
      ],
    });
    closeD108(run);
    await runToDone(run);

    const snap = run.snapshot();
    expect(snap.status).toBe("done");
    const trailer = snap.engine.state.trailers.find(
      ([id]) => id === "T-2291",
    )?.[1];
    expect(trailer?.location).toEqual({ kind: "dock", dockId: "D-112" });
    const shipment = snap.engine.state.shipments.find(
      ([id]) => id === "SH-5512",
    )?.[1];
    expect(shipment?.transferredQuantity).toBeGreaterThanOrEqual(9);
    expect(snap.events.map((e) => e.type)).toContain("commitment_committed");
    const closed = snap.engine.state.docks.find(([id]) => id === "D-108")?.[1];
    expect(closed?.status).toBe("closed");
    expect(snap.modelCalls.every((c) => c.outcome !== "rejected")).toBe(true);
  });

  it("contender T-3061 committing D-112 for an overlapping window is rejected with RESOURCE_UNAVAILABLE and recorded", async () => {
    const run = makeRun({
      "DOCK-C": [
        propose(
          "Unload T-2291 at D-112",
          [{ resourceId: "D-112", type: "dock" }],
          [{ agentId: "DOCK-C", role: "dock_lead" }],
        ),
        accept("DOCK-C", "C-1", 2),
        commit("C-1", "REQ-1"),
        propose(
          "Unload T-3061 at D-112",
          [{ resourceId: "D-112", type: "dock" }],
          [{ agentId: "DOCK-C", role: "dock_lead" }],
        ),
        accept("DOCK-C", "C-2", 3),
        commit("C-2", "REQ-2"),
      ],
    });
    closeD108(run);
    await runToDone(run);

    const snap = run.snapshot();
    const rejected = snap.modelCalls.filter((c) => c.outcome === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      toolName: "commit",
      reasonCode: "RESOURCE_UNAVAILABLE",
    });
    expect(snap.events.map((e) => e.type)).toContain("tool_rejected");
    expect(snap.events.map((e) => e.type)).toContain("commitment_rejected");
    const dock = snap.engine.state.docks.find(([id]) => id === "D-112")?.[1];
    expect(dock?.reservedCommitmentId).toBe("C-1");
  });

  it("unauthorized call is recorded as rejected PERMISSION_DENIED and does not mutate state", async () => {
    const run = makeRun({
      "DRV-047": [commit("C-1", "REQ-X")],
    });
    closeD108(run);
    const before = run.snapshot().engine;
    await runToDone(run);

    const snap = run.snapshot();
    expect(snap.modelCalls).toContainEqual(
      expect.objectContaining({
        agentId: "DRV-047",
        toolName: "commit",
        outcome: "rejected",
        reasonCode: "PERMISSION_DENIED",
      }),
    );
    expect(snap.engine).toEqual(before);
  });

  it("budget cap switches to baseline and records one escalation", async () => {
    const run = makeRun(
      {
        "DOCK-C": [
          propose(
            "Unload T-2291 at D-112",
            [{ resourceId: "D-112", type: "dock" }],
            [{ agentId: "DOCK-C", role: "dock_lead" }],
          ),
        ],
      },
      { initialBudget: { calls: 59 } },
    );
    closeD108(run);
    await run.step(2);
    await run.step(4);

    const snap = run.snapshot();
    expect(snap.budget.exhausted).toBe(true);
    const escalations = snap.events.filter((e) => e.kind === "escalation");
    expect(escalations).toHaveLength(1);
    expect(escalations[0].summary).toBe("budget reached, baseline takes over");
    const [first, second] = snap.modelCalls;
    expect(first.isFallback).toBe(false);
    expect(second).toMatchObject({
      isFallback: true,
      fallbackReason: "budget_exhausted",
    });
    const turnEvents = snap.events.filter((e) => e.type === "agent_turn");
    expect(turnEvents[1].provenance).toBe("baseline");
    expect(snap.events.some((e) => e.provenance === "nemotron")).toBe(false);
    expect(snap.budget.calls).toBe(60);
  });

  it("model calls carry tier from tierFor(role)", async () => {
    const tierFor = vi.fn((role: AgentRole) => TIERS[role]);
    const run = makeRun(
      {
        "DOCK-C": [wait()],
        "DRV-047": [wait()],
      },
      { tierFor },
    );
    closeD108(run);
    await runToDone(run);

    const { modelCalls } = run.snapshot();
    expect(modelCalls.length).toBeGreaterThanOrEqual(2);
    for (const c of modelCalls) expect(c.tier).toBe(TIERS[c.role]);
    expect(tierFor).toHaveBeenCalledWith("dock_lead");
    expect(tierFor).toHaveBeenCalledWith("driver");
  });

  it("unknown token counts stay null and are not counted toward the budget", async () => {
    const run = makeRun({ "DOCK-C": [wait()], "DRV-047": [wait()] });
    closeD108(run);
    await runToDone(run);
    const snap = run.snapshot();
    expect(snap.modelCalls.every((c) => c.promptTokens === null)).toBe(true);
    expect(snap.budget.tokens).toBe(0);
    expect(snap.budget.calls).toBe(2);
  });

  it("keeps an agent queued with its unread inbox when deliberation throws", async () => {
    const seen: TurnInput[] = [];
    let thrown = false;
    let offered = false;
    const flaky: Deliberator = {
      kind: "scripted",
      decide: async (input) => {
        if (input.agent.id === "DRV-047") {
          seen.push(input);
          if (!thrown) {
            thrown = true;
            throw new Error("boom");
          }
        }
        if (input.agent.id === "DOCK-C" && !offered) {
          offered = true;
          return propose(
            "Unload T-2291 at D-112",
            [{ resourceId: "D-112", type: "dock" }],
            [
              { agentId: "DOCK-C", role: "dock_lead" },
              { agentId: "DRV-047", role: "driver" },
            ],
          );
        }
        return wait();
      },
    };
    const run = new Run({
      runId: "run-flaky",
      mode: "live",
      deliberator: flaky,
      fallbackDeliberator: new ScriptedDeliberator({}),
      tierFor: (role) => TIERS[role],
    });
    closeD108(run);
    await expect(run.step(8)).rejects.toThrow("boom");
    expect(run.busy).toBe(false);
    await run.step(8);
    expect(seen).toHaveLength(2);
    expect(seen[0].inbox).toHaveLength(1);
    expect(seen[1].inbox).toEqual(seen[0].inbox);
    expect(run.snapshot().status).toBe("done");
  });
});
