import { describe, expect, it } from "vitest";
import { SimulationEngine } from "../engine/engine";
import { AgentRunner } from "./agent-runner";
import { fallbackLocalDeliberation } from "./nebius-client";
import { buildDeliberationPrompt } from "./prompts";
import { AgentToolCallSchema } from "./schemas";

describe("Agent Tool Schemas (Zod Validation)", () => {
  it("validates a well-formed propose tool call", () => {
    const raw = {
      tool: "propose",
      parameters: {
        task: "Relocate trailer T-2291 to D-112",
        requiredResources: [
          {
            resourceId: "D-112",
            type: "dock",
            startWindow: 51600,
            endWindow: 54300,
          },
        ],
        expiresAt: 52000,
        participants: [{ agentId: "DRV-047", role: "driver", accepted: false }],
      },
    };

    const result = AgentToolCallSchema.safeParse(raw);
    expect(result.success).toBe(true);
  });

  it("validates accept and commit tool calls", () => {
    const acceptCall = {
      tool: "accept",
      parameters: {
        participantId: "DRV-047",
        commitmentId: "C-88",
        acceptedAtVersion: 12,
      },
    };
    expect(AgentToolCallSchema.safeParse(acceptCall).success).toBe(true);

    const commitCall = {
      tool: "commit",
      parameters: {
        commitmentId: "C-88",
        requestId: "REQ-001",
      },
    };
    expect(AgentToolCallSchema.safeParse(commitCall).success).toBe(true);
  });

  it("validates physical movement and unload tool calls", () => {
    const moveCall = {
      tool: "executeMove",
      parameters: {
        trailerId: "T-2291",
        targetLocation: { kind: "dock", dockId: "D-112" },
        tractorId: "YT-2",
      },
    };
    expect(AgentToolCallSchema.safeParse(moveCall).success).toBe(true);

    const unloadCall = {
      tool: "executeUnload",
      parameters: {
        trailerId: "T-2291",
        shipmentId: "SH-5512",
        quantity: 13,
      },
    };
    expect(AgentToolCallSchema.safeParse(unloadCall).success).toBe(true);
  });

  it("rejects invalid payloads with violations", () => {
    const invalidUnload = {
      tool: "executeUnload",
      parameters: {
        trailerId: "T-2291",
        shipmentId: "SH-5512",
        quantity: -5, // Negative quantity rejected
      },
    };
    expect(AgentToolCallSchema.safeParse(invalidUnload).success).toBe(false);

    const missingParams = {
      tool: "executeMove",
      parameters: {
        trailerId: "T-2291",
        // Missing targetLocation
      },
    };
    expect(AgentToolCallSchema.safeParse(missingParams).success).toBe(false);
  });
});

describe("Agent Prompts & Scoped Observation", () => {
  it("builds prompt with scoped driver view and invariants", () => {
    const prompt = buildDeliberationPrompt(
      "driver",
      "DRV-047",
      { trailerId: "T-2291", cargoCount: 22 },
      [{ id: "M-311", purpose: "offer" }],
      [],
      [],
      "Protect 15:30 departure",
    );

    expect(prompt).toContain("autonomous Freight Driver Agent");
    expect(prompt).toContain("NON-NEGOTIABLE OPERATIONAL INVARIANTS");
    expect(prompt).toContain("DRV-047");
    expect(prompt).toContain("Protect 15:30 departure");
    expect(prompt).toContain("M-311");
  });
});

describe("Deterministic Fallback Deliberation", () => {
  it("generates accept tool call for driver with inbox offer", () => {
    const result = fallbackLocalDeliberation(
      "driver",
      "DRV-047",
      { time: 50850, trailerId: "T-2291" },
      [{ id: "M-311", purpose: "offer", payload: { commitmentId: "C-88" } }],
      15,
    );

    expect(result.toolCall?.tool).toBe("accept");
    expect(result.toolCall?.parameters.commitmentId).toBe("C-88");
  });

  it("generates propose tool call for dock lead when door is closed", () => {
    const result = fallbackLocalDeliberation(
      "dock_lead",
      "DOCK-C",
      {
        time: 50850,
        docks: [
          { id: "D-108", status: "closed" },
          { id: "D-112", status: "free" },
        ],
      },
      [],
      15,
    );

    expect(result.toolCall?.tool).toBe("propose");
    expect(result.thought).toContain("D-108 is closed");
  });
});

describe("AgentRunner End-to-End Orchestration Loop", () => {
  it("executes multi-agent coordination following a disruption", async () => {
    const engine = new SimulationEngine();
    const runner = new AgentRunner();

    // 1. Initial State: Trailer T-2291 at D-108
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

    expect(engine.getTrailer("T-2291")?.location).toEqual({
      kind: "dock",
      dockId: "D-108",
    });

    // 2. Inject Disruption H-1: Close D-108
    const disruptionResult = engine.injectDisruption(
      "H-1",
      "dock_closure",
      "D-108",
    );
    expect(disruptionResult.success).toBe(true);
    expect(engine.getDock("D-108")?.status).toBe("closed");

    // 3. Dock Lead DOCK-C deliberates and proposes relocation
    const dockLeadResult = await runner.deliberate("DOCK-C", engine);
    expect(dockLeadResult.toolCall?.tool).toBe("propose");
    expect(dockLeadResult.toolResult?.success).toBe(true);

    // 4. Send Offer message to Driver
    runner.sendMessage(
      "DOCK-C",
      "DRV-047",
      "offer",
      {
        commitmentId: dockLeadResult.toolResult?.affectedIds[0] ?? "C-PROP",
        doorId: "D-112",
      },
      engine.getLogicalTime(),
    );

    // 5. Driver DRV-047 deliberates and accepts offer
    const driverResult = await runner.deliberate("DRV-047", engine);
    expect(driverResult.toolCall?.tool).toBe("accept");

    // 6. Yard Controller YARD-1 executes move to D-112
    const yardResult = await runner.deliberate("YARD-1", engine);
    expect(yardResult.toolCall?.tool).toBe("executeMove");
    expect(yardResult.toolResult?.success).toBe(true);

    // 7. Verify physical invariants after move
    const trailer = engine.getTrailer("T-2291");
    expect(trailer?.location).toEqual({ kind: "dock", dockId: "D-112" });
    expect(engine.getDock("D-108")?.occupiedTrailerId).toBeUndefined();
    expect(engine.getDock("D-112")?.occupiedTrailerId).toBe("T-2291");

    // 8. Event log records full causal trail
    const events = engine.getEventLog();
    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain("dock_closed_disruption");
    expect(eventTypes).toContain("commitment_proposed");
    expect(eventTypes).toContain("trailer_moved");
  });
});
