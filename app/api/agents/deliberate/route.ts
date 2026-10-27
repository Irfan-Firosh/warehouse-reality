/**
 * API Route Handler: Agent Deliberation and Engine Execution (PRD §8, §10).
 * Server-side route calling NVIDIA/Nebius models and executing against authoritative engine.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { AgentRunner } from "@/lib/agents/agent-runner";
import { SimulationEngine } from "@/lib/engine/engine";
import { externalDisruptionTypeSchema } from "@/lib/external/disruption-types";

// Maintain a shared server-side simulation engine instance for the API session
const engine = new SimulationEngine();
const runner = new AgentRunner();

// Seed initial scenario state
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

const DeliberationRequestSchema = z.object({
  agentId: z.string().default("DRV-047"),
  directive: z.string().optional(),
  disruption: z
    .object({
      disruptionId: z.string(),
      type: externalDisruptionTypeSchema,
      targetId: z.string(),
    })
    .optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = DeliberationRequestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.format() },
        { status: 400 },
      );
    }

    const { agentId, directive, disruption } = parsed.data;

    // Handle operator disruption injection if specified
    if (disruption) {
      engine.injectDisruption(
        disruption.disruptionId,
        disruption.type,
        disruption.targetId,
      );
    }

    // Run agent deliberation cycle
    const result = await runner.deliberate(agentId, engine, directive);

    return NextResponse.json({
      success: true,
      deliberation: result,
      logicalTime: engine.getLogicalTime(),
      stateVersion: engine.getStateVersion(),
      eventCount: engine.getEventLog().length,
      recentEvents: engine.getEventLog().slice(-5),
    });
  } catch (error) {
    console.error("Agent deliberation route error:", error);
    return NextResponse.json(
      {
        error: "Internal server error during agent deliberation",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
