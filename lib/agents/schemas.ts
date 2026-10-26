/**
 * Zod Schemas for Agent Tool Calling (PRD §8, §10).
 * Enforces strict input validation before any engine mutation.
 */

import { z } from "zod";

export const PhysicalLocationSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("dock"),
    dockId: z.string().min(1),
  }),
  z.object({
    kind: z.literal("stall"),
    stallId: z.string().min(1),
  }),
  z.object({
    kind: z.literal("coupled"),
    tractorId: z.string().min(1),
  }),
  z.object({
    kind: z.literal("gate"),
    queueIndex: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal("yard_lane"),
    laneId: z.string().min(1),
  }),
  z.object({
    kind: z.literal("in_transit"),
    from: z.string().min(1),
    to: z.string().min(1),
  }),
]);

export const ResourceReservationSchema = z.object({
  resourceId: z.string().min(1),
  type: z.enum(["dock", "stall", "equipment", "worker", "trailer", "tractor"]),
  startWindow: z.number().nonnegative(),
  endWindow: z.number().nonnegative(),
});

export const CommitmentParticipantSchema = z.object({
  agentId: z.string().min(1),
  role: z.string().min(1),
  accepted: z.boolean().default(false),
  acceptedAtVersion: z.number().int().optional(),
});

export const ProposeToolSchema = z.object({
  task: z.string().min(1),
  requiredResources: z.array(ResourceReservationSchema).min(1),
  expiresAt: z.number().nonnegative(),
  participants: z.array(CommitmentParticipantSchema).min(1),
});

export const AcceptToolSchema = z.object({
  participantId: z.string().min(1),
  commitmentId: z.string().min(1),
  acceptedAtVersion: z.number().int().nonnegative(),
});

export const CommitToolSchema = z.object({
  commitmentId: z.string().min(1),
  requestId: z.string().min(1),
});

export const ExecuteMoveToolSchema = z.object({
  trailerId: z.string().min(1),
  targetLocation: PhysicalLocationSchema,
  tractorId: z.string().optional(),
});

export const ExecuteUnloadToolSchema = z.object({
  trailerId: z.string().min(1),
  shipmentId: z.string().min(1),
  quantity: z.number().positive(),
});

export const InjectDisruptionToolSchema = z.object({
  disruptionId: z.string().min(1),
  type: z.enum(["dock_closure", "equipment_failure"]),
  targetId: z.string().min(1),
});

export const CancelToolSchema = z.object({
  commitmentId: z.string().min(1),
  reason: z.string().min(1),
});

export const EscalateToolSchema = z.object({
  reason: z.string().min(1),
  participants: z.array(z.string()).min(1),
  unresolvedChoices: z.array(z.string()).min(1),
});

export const ObserveToolSchema = z.object({
  role: z.enum(["driver", "dock_lead", "yard_controller"]),
  agentEntityId: z.string().min(1),
});

export const AgentToolCallSchema = z.discriminatedUnion("tool", [
  z.object({
    tool: z.literal("propose"),
    parameters: ProposeToolSchema,
  }),
  z.object({
    tool: z.literal("accept"),
    parameters: AcceptToolSchema,
  }),
  z.object({
    tool: z.literal("commit"),
    parameters: CommitToolSchema,
  }),
  z.object({
    tool: z.literal("executeMove"),
    parameters: ExecuteMoveToolSchema,
  }),
  z.object({
    tool: z.literal("executeUnload"),
    parameters: ExecuteUnloadToolSchema,
  }),
  z.object({
    tool: z.literal("injectDisruption"),
    parameters: InjectDisruptionToolSchema,
  }),
  z.object({
    tool: z.literal("cancel"),
    parameters: CancelToolSchema,
  }),
  z.object({
    tool: z.literal("escalate"),
    parameters: EscalateToolSchema,
  }),
  z.object({
    tool: z.literal("observe"),
    parameters: ObserveToolSchema,
  }),
]);

export type ValidatedToolCall = z.infer<typeof AgentToolCallSchema>;
