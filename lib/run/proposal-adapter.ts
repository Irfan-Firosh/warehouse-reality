/**
 * Adapts a model's validated `propose` tool input into an engine
 * CommitmentProposal. Pure: no state access, ids come from the caller.
 */

import type { z } from "zod";
import type { ProposeToolSchema } from "../agents/schemas";
import type { CommitmentProposal } from "../engine/commitments";

export type ProposeInput = z.infer<typeof ProposeToolSchema>;

export interface ProposalContext {
  logicalTime: number;
  nextId: () => string;
}

export type ProposalAdapterResult =
  | { ok: true; proposal: CommitmentProposal }
  | {
      ok: false;
      reasonCode: "OFFER_EXPIRED" | "INVARIANT_VIOLATION";
      message: string;
    };

export const toCommitmentProposal = (
  input: ProposeInput,
  ctx: ProposalContext,
): ProposalAdapterResult => {
  if (input.expiresAt <= ctx.logicalTime) {
    return {
      ok: false,
      reasonCode: "OFFER_EXPIRED",
      message: `Proposal expiresAt ${input.expiresAt} is not after current logical time ${ctx.logicalTime}.`,
    };
  }

  for (const r of input.requiredResources) {
    if (r.endWindow <= r.startWindow) {
      return {
        ok: false,
        reasonCode: "INVARIANT_VIOLATION",
        message: `Reservation for ${r.resourceId} must end after it starts (start ${r.startWindow}, end ${r.endWindow}).`,
      };
    }
  }

  return {
    ok: true,
    proposal: {
      id: ctx.nextId(),
      task: input.task,
      participants: input.participants.map((p) => ({
        agentId: p.agentId,
        role: p.role,
      })),
      requiredResources: input.requiredResources.map((r) => ({ ...r })),
      expiresInSeconds: input.expiresAt - ctx.logicalTime,
    },
  };
};
