/**
 * Deliberator that replays prewritten decisions per agent, in order. Used as a
 * test double by both lanes. Once an agent's script runs out it waits (no tool
 * call), so a Run always terminates.
 */

import type { Deliberator, TurnDecision, TurnInput } from "../../types/run";

export class ScriptedDeliberator implements Deliberator {
  readonly kind = "scripted" as const;
  private readonly cursors = new Map<string, number>();

  constructor(private readonly scripts: Record<string, TurnDecision[]>) {}

  async decide(input: TurnInput): Promise<TurnDecision> {
    const agentId = input.agent.id;
    const index = this.cursors.get(agentId) ?? 0;
    const next = this.scripts[agentId]?.[index];
    if (next) {
      this.cursors.set(agentId, index + 1);
      return next;
    }
    return {
      thought: "Script exhausted; waiting.",
      call: {
        agentId,
        role: input.agent.role,
        tier: input.tier,
        model: "scripted",
        isFallback: false,
        latencyMs: 0,
        promptTokens: null,
        completionTokens: null,
        logicalTime: input.logicalTime,
        stateVersion: input.stateVersion,
      },
    };
  }
}
