/**
 * React Hook: Authoritative Simulation & Agent Runtime Integration (PRD §8, §11, §13).
 * Wires the authoritative engine, multi-agent LLM runtime, and React dashboard together.
 */

"use client";

import { useCallback, useRef, useState } from "react";
import { AgentRunner } from "@/lib/agents/agent-runner";
import type { AgentState, DeliberationResult } from "@/lib/agents/types";
import { SimulationEngine } from "@/lib/engine/engine";
import type { CommitmentEntity } from "@/lib/engine/types";
import type { DashboardCounts, TimelineEvent } from "@/types/dashboard";
import {
  calculateDashboardCounts as getStaticCounts,
  TIMELINE_EVENTS as INITIAL_TIMELINE_EVENTS,
} from "./data";

export interface SimulationHookState {
  engine: SimulationEngine;
  runner: AgentRunner;
  logicalTime: string;
  rawTime: number;
  stateVersion: number;
  isPaused: boolean;
  speed: 1 | 4 | 16;
  isDeliberating: boolean;
  activeAgentId: string;
  agents: AgentState[];
  commitments: CommitmentEntity[];
  timelineEvents: TimelineEvent[];
  counts: DashboardCounts;
  lastDeliberation: DeliberationResult | null;
  togglePause: () => void;
  setSpeed: (speed: 1 | 4 | 16) => void;
  setActiveAgentId: (id: string) => void;
  nextStep: () => Promise<void>;
  injectDisruption: (disruptionId: string) => Promise<void>;
  triggerAgentDeliberation: (
    agentId?: string,
    directive?: string,
  ) => Promise<DeliberationResult>;
  createCheckpoint: () => string;
}

const formatSecondsToClock = (secs: number): string => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export const useSimulation = (): SimulationHookState => {
  const engineRef = useRef<SimulationEngine | null>(null);
  const runnerRef = useRef<AgentRunner | null>(null);

  // Initialize once
  if (!engineRef.current) {
    const engine = new SimulationEngine({ startTime: 50850 }); // 14:07:30

    // Seed scenario entities: D-108 occupied by T-2291 with 22 pallets
    engine.addTrailer({
      id: "T-2291",
      location: { kind: "dock", dockId: "D-108" },
      cargo: [{ shipmentId: "SH-5512", quantity: 22 }],
      doorOpen: true,
      status: "serving",
    });

    engine.addTractor({
      id: "YT-2",
      role: "yard",
      status: "idle",
    });

    engine.addEquipment({
      id: "F-07",
      type: "forklift",
      status: "working",
    });

    engineRef.current = engine;
  }

  if (!runnerRef.current) {
    runnerRef.current = new AgentRunner();
  }

  const engine = engineRef.current;
  const runner = runnerRef.current;

  const [rawTime, setRawTime] = useState(engine.getLogicalTime());
  const [stateVersion, setStateVersion] = useState(engine.getStateVersion());
  const [isPaused, setIsPaused] = useState(true);
  const [speed, setSpeed] = useState<1 | 4 | 16>(4);
  const [isDeliberating, setIsDeliberating] = useState(false);
  const [activeAgentId, setActiveAgentId] = useState("DRV-047");
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([
    ...INITIAL_TIMELINE_EVENTS,
  ]);
  const [lastDeliberation, setLastDeliberation] =
    useState<DeliberationResult | null>(null);
  const [commitments, setCommitments] = useState<CommitmentEntity[]>(() => {
    const cp = engine.createCheckpoint();
    return cp.state.commitments.map(([, v]) => v);
  });
  const [agents, setAgents] = useState<AgentState[]>(() =>
    runner.getAllAgents(),
  );

  const refreshState = useCallback(() => {
    setRawTime(engine.getLogicalTime());
    setStateVersion(engine.getStateVersion());
    setAgents([...runner.getAllAgents()]);
    const cp = engine.createCheckpoint();
    setCommitments(cp.state.commitments.map(([, v]) => v));
  }, [engine, runner]);

  const togglePause = useCallback(() => {
    setIsPaused((p) => !p);
  }, []);

  const triggerAgentDeliberation = useCallback(
    async (
      agentId?: string,
      directive?: string,
    ): Promise<DeliberationResult> => {
      const targetId = agentId ?? activeAgentId;
      setIsDeliberating(true);
      try {
        const result = await runner.deliberate(targetId, engine, directive);
        setLastDeliberation(result);

        // Add model deliberation event to timeline
        if (result.toolCall) {
          const newEvent: TimelineEvent = {
            id: `ACT-${Date.now().toString().slice(-4)}`,
            time: formatSecondsToClock(engine.getLogicalTime()),
            source: `${targetId} (${result.role})`,
            title: `${result.toolCall.tool}: ${result.thought.slice(0, 45)}...`,
            type:
              result.toolCall.tool === "accept"
                ? "accept"
                : result.toolCall.tool === "propose"
                  ? "offer"
                  : result.toolCall.tool === "commit"
                    ? "commit"
                    : "action",
            isLLM: true,
          };
          setTimelineEvents((prev) => [...prev, newEvent]);
        }

        refreshState();
        return result;
      } finally {
        setIsDeliberating(false);
      }
    },
    [activeAgentId, engine, refreshState, runner],
  );

  const nextStep = useCallback(async () => {
    // Advance engine clock by 30 seconds
    const newTime = engine.getLogicalTime() + 30;
    engine.emitEvent({
      id: `TICK-${newTime}`,
      logicalTime: newTime,
      type: "clock_tick",
      affectedIds: [],
      stateVersion: engine.getStateVersion(),
    });
    // Run deliberation for active agent
    await triggerAgentDeliberation(activeAgentId);
  }, [activeAgentId, engine, triggerAgentDeliberation]);

  const injectDisruption = useCallback(
    async (disruptionId: string) => {
      if (disruptionId === "H-1") {
        // Dock closure on D-108
        engine.injectDisruption("H-1", "dock_closure", "D-108");

        const disEvent: TimelineEvent = {
          id: `E-${Date.now().toString().slice(-4)}`,
          time: formatSecondsToClock(engine.getLogicalTime()),
          source: "DISRUPTION H-1",
          title: "D-108 closed (14:00–16:00)",
          type: "disruption",
          tag: "injected",
        };

        setTimelineEvents((prev) => [...prev, disEvent]);
        refreshState();

        // Trigger Dock Lead replanning
        await triggerAgentDeliberation(
          "DOCK-C",
          "D-108 closed due to H-1. Reassign T-2291 to available door D-112.",
        );
      } else if (disruptionId === "H-2") {
        // Equipment failure on F-07
        engine.injectDisruption("H-2", "equipment_failure", "F-07");

        const disEvent: TimelineEvent = {
          id: `E-${Date.now().toString().slice(-4)}`,
          time: formatSecondsToClock(engine.getLogicalTime()),
          source: "DISRUPTION H-2",
          title: "Forklift F-07 hydraulic fault",
          type: "disruption",
          tag: "injected",
        };

        setTimelineEvents((prev) => [...prev, disEvent]);
        refreshState();

        // Trigger Supervisor or Yard replanning
        await triggerAgentDeliberation(
          "SUP-1",
          "Forklift F-07 failed. Reallocate backup material handling resources.",
        );
      } else {
        const disEvent: TimelineEvent = {
          id: `E-${Date.now().toString().slice(-4)}`,
          time: formatSecondsToClock(engine.getLogicalTime()),
          source: "DISRUPTION H-3",
          title: "Inbound driver delay +45m",
          type: "disruption",
          tag: "injected",
        };
        setTimelineEvents((prev) => [...prev, disEvent]);
        refreshState();
      }
    },
    [engine, refreshState, triggerAgentDeliberation],
  );

  const createCheckpoint = useCallback((): string => {
    const cp = engine.createCheckpoint();
    const id = `CP-${Date.now().toString().slice(-4)}`;
    return `Saved checkpoint ${id} (state version v${cp.stateVersion})`;
  }, [engine]);

  // Derive counts from engine state
  const counts: DashboardCounts = getStaticCounts();

  return {
    engine,
    runner,
    logicalTime: formatSecondsToClock(rawTime),
    rawTime,
    stateVersion,
    isPaused,
    speed,
    isDeliberating,
    activeAgentId,
    agents,
    commitments,
    timelineEvents,
    counts,
    lastDeliberation,
    togglePause,
    setSpeed,
    setActiveAgentId,
    nextStep,
    injectDisruption,
    triggerAgentDeliberation,
    createCheckpoint,
  };
};
