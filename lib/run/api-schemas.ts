/**
 * Zod bodies for the /api/runs routes (plan Task 0).
 */

import { z } from "zod";

export const CreateRunBody = z.object({
  scenarioId: z.literal("d108"),
  mode: z.enum(["live", "baseline"]),
});
export type CreateRunBody = z.infer<typeof CreateRunBody>;

export const StepBody = z.object({
  maxTurns: z.number().int().min(1).max(8).default(4),
});
export type StepBody = z.infer<typeof StepBody>;

export const RunSourceSchema = z.object({
  title: z.string().min(1),
  url: z.url(),
});

export const DisruptionBody = z.object({
  type: z.enum(["dock_closure", "equipment_failure", "external_delay"]),
  targetId: z.string().min(1),
  sources: z.array(RunSourceSchema).optional(),
});
export type DisruptionBody = z.infer<typeof DisruptionBody>;
