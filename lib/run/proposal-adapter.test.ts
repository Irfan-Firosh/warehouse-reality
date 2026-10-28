import { describe, expect, it } from "vitest";
import type { z } from "zod";
import type { ProposeToolSchema } from "../agents/schemas";
import { toCommitmentProposal } from "./proposal-adapter";

type ProposeInput = z.infer<typeof ProposeToolSchema>;

const baseInput = (overrides: Partial<ProposeInput> = {}): ProposeInput => ({
  task: "Unload T-1 at D-112",
  requiredResources: [
    { resourceId: "D-112", type: "dock", startWindow: 50400, endWindow: 52000 },
  ],
  expiresAt: 50700,
  participants: [{ agentId: "DRV-1", role: "driver", accepted: false }],
  ...overrides,
});

describe("toCommitmentProposal", () => {
  it("assigns a stable id from nextId", () => {
    const result = toCommitmentProposal(baseInput(), {
      logicalTime: 50400,
      nextId: () => "C-1",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.proposal.id).toBe("C-1");
  });

  it("converts expiresAt to expiresInSeconds", () => {
    const result = toCommitmentProposal(baseInput(), {
      logicalTime: 50400,
      nextId: () => "C-1",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.proposal.expiresInSeconds).toBe(300);
  });

  it("rejects expiresAt at or before now with OFFER_EXPIRED", () => {
    for (const expiresAt of [50400, 50000]) {
      const result = toCommitmentProposal(baseInput({ expiresAt }), {
        logicalTime: 50400,
        nextId: () => "C-1",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reasonCode).toBe("OFFER_EXPIRED");
    }
  });

  it("rejects a reservation with endWindow <= startWindow with INVARIANT_VIOLATION", () => {
    const result = toCommitmentProposal(
      baseInput({
        requiredResources: [
          {
            resourceId: "D-112",
            type: "dock",
            startWindow: 51000,
            endWindow: 51000,
          },
        ],
      }),
      { logicalTime: 50400, nextId: () => "C-1" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasonCode).toBe("INVARIANT_VIOLATION");
  });
});
