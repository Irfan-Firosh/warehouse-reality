/**
 * Agent Runner & Orchestration Engine (PRD §8, §9, §10).
 * Coordinates agent deliberation cycles, scoped observations, tool validations, and engine mutations.
 */

import type { CommitmentProposal } from "../engine/commitments";
import type { SimulationEngine } from "../engine/engine";
import type { EntityId, PhysicalLocation, ToolResult } from "../engine/types";
import { callNebiusModel } from "./nebius-client";
import { buildDeliberationPrompt } from "./prompts";
import { AgentToolCallSchema } from "./schemas";
import type {
  AgentMessage,
  AgentState,
  AgentToolCall,
  DeliberationResult,
} from "./types";

export class AgentRunner {
  private agents = new Map<EntityId, AgentState>();
  private messageCounter = 0;

  constructor() {
    this.registerDefaultAgents();
  }

  private registerDefaultAgents(): void {
    // 1. Driver DRV-047 (Trailer T-2291)
    this.registerAgent({
      id: "DRV-047",
      role: "driver",
      name: "Driver DRV-047",
      assignedEntityId: "T-2291",
      goals: [
        {
          id: "G-1",
          description: "Deliver inbound 22 pallets by 15:30",
          priority: "high",
          targetTime: 55800,
        },
      ],
      obligations: [],
      inbox: [
        {
          id: "M-311",
          fromAgentId: "DOCK-C",
          toAgentId: "DRV-047",
          purpose: "offer",
          payload: {
            commitmentId: "C-88",
            doorId: "D-112",
            window: "14:20-15:05",
          },
          sentAt: 50560,
        },
      ],
      outbox: [],
      memory: [
        {
          id: "MEM-1",
          timestamp: 50400,
          type: "observation",
          summary: "Arrived at D-108; started unload.",
        },
        {
          id: "MEM-2",
          timestamp: 50520,
          type: "observation",
          summary: "D-108 closed due to disruption H-1.",
        },
      ],
      fallbackCounter: 0,
    });

    // 2. Dock Lead DOCK-C (Sector C)
    this.registerAgent({
      id: "DOCK-C",
      role: "dock_lead",
      name: "Dock Lead C",
      assignedEntityId: "D-108",
      goals: [
        {
          id: "G-2",
          description:
            "Maximize dock door throughput and clear delayed trailers",
          priority: "high",
        },
      ],
      obligations: [],
      inbox: [],
      outbox: [],
      memory: [],
      fallbackCounter: 0,
    });

    // 3. Yard Controller YARD-1
    this.registerAgent({
      id: "YARD-1",
      role: "yard_controller",
      name: "Yard Controller 1",
      assignedEntityId: "YT-2",
      goals: [
        {
          id: "G-3",
          description:
            "Prevent yard congestion and execute authorized moves safely",
          priority: "normal",
        },
      ],
      obligations: [],
      inbox: [],
      outbox: [],
      memory: [],
      fallbackCounter: 0,
    });

    // 4. Supervisor SUP-1
    this.registerAgent({
      id: "SUP-1",
      role: "supervisor",
      name: "Operations Supervisor",
      assignedEntityId: "FACILITY",
      goals: [
        {
          id: "G-4",
          description: "Maintain shift SLA compliance and resolve escalations",
          priority: "critical",
        },
      ],
      obligations: [],
      inbox: [],
      outbox: [],
      memory: [],
      fallbackCounter: 0,
    });
  }

  public registerAgent(agent: AgentState): void {
    this.agents.set(agent.id, agent);
  }

  public getAgent(agentId: EntityId): AgentState | undefined {
    return this.agents.get(agentId);
  }

  public getAllAgents(): AgentState[] {
    return Array.from(this.agents.values());
  }

  public sendMessage(
    fromAgentId: EntityId,
    toAgentId: EntityId,
    purpose: AgentMessage["purpose"],
    payload: Record<string, unknown>,
    logicalTime: number,
  ): AgentMessage {
    this.messageCounter += 1;
    const msg: AgentMessage = {
      id: `M-${this.messageCounter}`,
      fromAgentId,
      toAgentId,
      purpose,
      payload,
      sentAt: logicalTime,
    };

    const sender = this.agents.get(fromAgentId);
    if (sender) {
      sender.outbox.push(msg);
      sender.memory.push({
        id: `MEM-MSG-${msg.id}`,
        timestamp: logicalTime,
        type: "message_sent",
        summary: `Sent ${purpose} to ${toAgentId}`,
        details: payload,
      });
    }

    const recipient = this.agents.get(toAgentId);
    if (recipient) {
      recipient.inbox.push(msg);
      recipient.memory.push({
        id: `MEM-RECV-${msg.id}`,
        timestamp: logicalTime,
        type: "message_received",
        summary: `Received ${purpose} from ${fromAgentId}`,
        details: payload,
      });
    }

    return msg;
  }

  /**
   * Run one deliberative step for a specified agent against the authoritative simulation engine.
   */
  public async deliberate(
    agentId: EntityId,
    engine: SimulationEngine,
    userDirective?: string,
  ): Promise<DeliberationResult> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not registered in runner.`);
    }

    // 1. Observe scoped environment
    const observation =
      agent.role === "supervisor"
        ? {
            time: engine.getLogicalTime(),
            version: engine.getStateVersion(),
            role: "supervisor",
            activeCommitments: engine.createCheckpoint().state.commitments,
            recentEvents: engine.getEventLog().slice(-5),
          }
        : (engine.observe(agent.role, agent.assignedEntityId) as Record<
            string,
            unknown
          >);

    // Record observation in memory
    agent.memory.push({
      id: `MEM-OBS-${Date.now()}`,
      timestamp: engine.getLogicalTime(),
      type: "observation",
      summary: `Observed local state at version v${engine.getStateVersion()}`,
      details: observation,
    });

    // 2. Formulate prompt
    const prompt = buildDeliberationPrompt(
      agent.role,
      agent.id,
      observation,
      agent.inbox,
      agent.obligations,
      agent.memory.slice(-5),
      userDirective,
    );

    // 3. Call Model with fallback
    const llmResult = await callNebiusModel(
      [{ role: "user", content: prompt }],
      agent.role,
      agent.id,
      observation,
      agent.inbox as unknown as Array<Record<string, unknown>>,
      engine.getStateVersion(),
    );

    let toolResult: ToolResult | undefined;
    let validatedCall: AgentToolCall | undefined;

    // 4. Validate and Execute Tool Call
    if (llmResult.toolCall) {
      const validation = AgentToolCallSchema.safeParse(llmResult.toolCall);
      if (validation.success) {
        validatedCall = validation.data as AgentToolCall;
        toolResult = this.executeEngineTool(validatedCall, engine);

        // Record tool call in memory
        agent.memory.push({
          id: `MEM-TOOL-${Date.now()}`,
          timestamp: engine.getLogicalTime(),
          type: "tool_call",
          summary: `Executed ${validatedCall.tool} (success: ${toolResult.success})`,
          details: {
            parameters: validatedCall.parameters,
            result: toolResult,
          },
        });
      } else {
        console.warn(
          "Invalid tool call rejected by Zod schema:",
          validation.error,
        );
        toolResult = {
          success: false,
          reasonCode: "INVARIANT_VIOLATION",
          message: `Tool validation failed: ${validation.error.message}`,
          affectedIds: [agentId],
          stateVersion: engine.getStateVersion(),
          eventIds: [],
        };
      }
    }

    return {
      agentId: agent.id,
      role: agent.role,
      thought: llmResult.thought,
      toolCall: validatedCall,
      toolResult,
      escalated: validatedCall?.tool === "escalate",
    };
  }

  private executeEngineTool(
    toolCall: AgentToolCall,
    engine: SimulationEngine,
  ): ToolResult {
    const { tool, parameters } = toolCall;

    switch (tool) {
      case "propose":
        return engine.propose(parameters as unknown as CommitmentProposal);

      case "accept": {
        const { participantId, commitmentId, acceptedAtVersion } =
          parameters as {
            participantId: EntityId;
            commitmentId: EntityId;
            acceptedAtVersion: number;
          };
        return engine.accept(participantId, commitmentId, acceptedAtVersion);
      }

      case "commit": {
        const { commitmentId, requestId } = parameters as {
          commitmentId: EntityId;
          requestId: string;
        };
        return engine.commit(commitmentId, requestId);
      }

      case "executeMove": {
        const { trailerId, targetLocation, tractorId } = parameters as {
          trailerId: EntityId;
          targetLocation: PhysicalLocation;
          tractorId?: EntityId;
        };
        return engine.executeMove(trailerId, targetLocation, tractorId);
      }

      case "executeUnload": {
        const { trailerId, shipmentId, quantity } = parameters as {
          trailerId: EntityId;
          shipmentId: EntityId;
          quantity: number;
        };
        return engine.executeUnload(trailerId, shipmentId, quantity);
      }

      case "injectDisruption": {
        const { disruptionId, type, targetId } = parameters as {
          disruptionId: string;
          type: "dock_closure" | "equipment_failure";
          targetId: EntityId;
        };
        return engine.injectDisruption(disruptionId, type, targetId);
      }

      case "escalate": {
        const { reason, participants } = parameters as {
          reason: string;
          participants: EntityId[];
        };
        return {
          success: true,
          message: `Escalated to Supervisor: ${reason}`,
          affectedIds: participants,
          stateVersion: engine.getStateVersion(),
          eventIds: [],
        };
      }

      case "cancel": {
        const { commitmentId, reason } = parameters as {
          commitmentId: EntityId;
          reason: string;
        };
        return {
          success: true,
          message: `Cancelled commitment ${commitmentId}: ${reason}`,
          affectedIds: [commitmentId],
          stateVersion: engine.getStateVersion(),
          eventIds: [],
        };
      }
      default:
        return {
          success: true,
          affectedIds: [],
          stateVersion: engine.getStateVersion(),
          eventIds: [],
        };
    }
  }
}
