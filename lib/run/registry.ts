/**
 * In-memory registry of server-owned runs. A server restart wipes it; callers
 * see RUN_NOT_FOUND for unknown ids.
 */

import type { Deliberator, ModelTier } from "../../types/run";
import type { AgentRole } from "../agents/types";
import type { CreateRunBody } from "./api-schemas";
import { Run } from "./run";
import { ScriptedDeliberator } from "./scripted-deliberator";

const MAX_RUNS = 20;

export const tierFor = (role: AgentRole): ModelTier => {
  switch (role) {
    case "driver":
      return "nano";
    case "dock_lead":
    case "yard_controller":
      return "super";
    case "supervisor":
      return "ultra";
  }
};

/**
 * Single swap point for deliberators. Placeholder: ScriptedDeliberator stands
 * in for B2's createNemotronDeliberator() (live) and A8's BaselineDeliberator
 * (baseline) until they merge.
 */
const deliberatorsFor = (
  _mode: CreateRunBody["mode"],
): { deliberator: Deliberator; fallbackDeliberator: Deliberator } => ({
  deliberator: new ScriptedDeliberator({}),
  fallbackDeliberator: new ScriptedDeliberator({}),
});

// Shared via globalThis so route bundles and dev HMR see one registry.
const globalStore = globalThis as typeof globalThis & {
  __wsRunRegistry?: Map<string, Run>;
};
globalStore.__wsRunRegistry ??= new Map<string, Run>();
const runs = globalStore.__wsRunRegistry;

export const createRun = (body: CreateRunBody): Run => {
  const run = new Run({
    runId: crypto.randomUUID(),
    mode: body.mode,
    tierFor,
    ...deliberatorsFor(body.mode),
  });
  runs.set(run.snapshot().runId, run);
  // Evict the oldest idle runs; a run mid-step stays so its client can finish.
  for (const [id, candidate] of runs) {
    if (runs.size <= MAX_RUNS) break;
    if (!candidate.busy) runs.delete(id);
  }
  return run;
};

export const getRun = (runId: string): Run | undefined => runs.get(runId);
