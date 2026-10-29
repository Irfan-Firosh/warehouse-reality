/**
 * Agent System Prompts & Instruction Templates (PRD §8, §10).
 * Enforces role boundaries, local view restrictions, and tool call formats.
 */

import type { TurnInput } from "../../types/run";
import type { AgentMessage, AgentRole, AgentState } from "./types";

export const AGENT_ROLE_INSTRUCTIONS: Record<AgentRole, string> = {
  driver: `You are an autonomous Freight Driver Agent.
Your authority and local observation view is strictly limited to:
- Your own assigned tractor and trailer.
- Your own cargo manifest, remaining pallets, and appointment time.
- Incoming messages/offers sent directly to you by the dock lead or yard controller.
You CANNOT observe unassigned facility doors, stalls, or other trucks.
Your primary goal is to ensure safe, on-time cargo delivery and turnaround.
When a door disruption occurs, you evaluate alternative offers and accept feasible dock windows.`,

  dock_lead: `You are an autonomous Facility Dock Lead Agent.
Your authority and local observation view is strictly limited to:
- Assigned dock-high doors and ramps in your sector (e.g. DFW Sector C: D-108, D-112, etc.).
- Active unload commitments and queues awaiting doors.
- Requests from inbound drivers for dock appointments.
You coordinate dock allocation, propose atomic commitment windows, and commit allocations once all participants agree.
If a dock door is closed due to a disruption, you identify alternative available doors and initiate reallocation proposals.`,

  yard_controller: `You are an autonomous Yard Controller Agent.
Your authority and local observation view is strictly limited to:
- Trailer parking stalls (e.g. P-001 through P-235).
- Assigned yard hostler tractors (e.g. YT-2) and movement resources.
- Active relocation requests between docks and stalls.
You authorize and execute trailer moves across approved yard lanes and stalls.
You enforce the single-trailer-per-location and tractor coupling invariants.`,

  supervisor: `You are an autonomous Facility Operations Supervisor Agent.
Your authority includes:
- Resolving escalations and priority disputes when automated agent negotiation deadlocks.
- Granting policy exceptions within physical capacity invariants.
- Monitoring facility-wide throughput and SLA bottlenecks.
You do NOT micromanage individual routine movements, but act as the final arbiter for escalated conflicts.`,
};

const OPERATING_RULES = `You are an autonomous operational agent operating within an authoritative discrete-event warehouse simulator.

NON-NEGOTIABLE OPERATIONAL INVARIANTS:
1. Physical State Authority: You CANNOT mutate physical state directly with free text. All physical mutations and reservations must occur via valid tool calls.
2. Two-Phase Commitments: Resources (docks, stalls, equipment, workers) are only reserved upon atomic commitment. Proposed or partially accepted offers do not lock capacity.
3. Stale Version Rejection: All state changes must match the current state version. Stale requests are rejected.
4. Single Location & Conservation: A trailer can only be at one location at a time. Cargo transfers strictly conserve quantities.
5. Scoped Observation: You can only act upon what is in your local observation and inbox. Never guess or fabricate global state.`;

export const COMMON_SYSTEM_PROMPT = `${OPERATING_RULES}

OUTPUT FORMAT:
Always respond with a valid JSON object with the following structure:
{
  "thought": "Your internal deliberation and step-by-step reasoning based on local observations and goals",
  "toolCall": {
    "tool": "propose" | "accept" | "commit" | "executeMove" | "executeUnload" | "cancel" | "escalate",
    "parameters": { ... }
  }
}
If no action is necessary at this logical tick, omit "toolCall" or set it to null.`;

export const buildDeliberationPrompt = (
  role: AgentRole,
  agentId: string,
  localObservation: Record<string, unknown>,
  inbox: unknown[],
  obligations: unknown[],
  recentMemory: unknown[],
  userDirective?: string,
): string => {
  return `${COMMON_SYSTEM_PROMPT}

${AGENT_ROLE_INSTRUCTIONS[role]}

AGENT IDENTITY:
- Agent ID: ${agentId}
- Role: ${role}

CURRENT LOCAL OBSERVATION:
${JSON.stringify(localObservation, null, 2)}

INBOX (MESSAGES & OFFERS):
${JSON.stringify(inbox, null, 2)}

CURRENT OBLIGATIONS:
${JSON.stringify(obligations, null, 2)}

RECENT LOCAL MEMORY:
${JSON.stringify(recentMemory, null, 2)}
${userDirective ? `\nSUPERVISOR / OPERATOR DIRECTIVE:\n${userDirective}\n` : ""}

Evaluate your observations and pending messages. If an action or response is required, formulate your deliberation thought and the appropriate structured toolCall.`;
};

/** Recent memory items sent with each tool-calling turn. */
const TURN_MEMORY_ITEMS = 8;
/** Recent commitment messages (sent and received) sent with each turn. */
const TURN_COMMITMENT_MESSAGES = 12;

export const TOOL_CALLING_SYSTEM_PROMPT = `${OPERATING_RULES}

HOW TO ACT:
Act only by calling exactly one of the provided tools per turn. Never answer in plain text.
If nothing needs doing this turn, call the "wait" tool with a short reason.
Use the current state version for any acceptedAtVersion. Use only IDs that appear in your observation, inbox, counterparts or scenario facts.`;

export interface TurnMessage {
  role: "system" | "user";
  content: string;
}

/** Facts about a turn that the agent's own observation does not carry. */
export interface TurnContext {
  /** Every agent in the run: id, role and the entity it is assigned to. */
  roster: ReadonlyArray<Pick<AgentState, "id" | "role" | "assignedEntityId">>;
  /** Scenario facts the role cannot observe, labeled with their provenance. */
  scenarioFacts: Record<string, unknown>;
}

const commitmentOf = (m: AgentMessage): string =>
  typeof m.payload.commitmentId === "string" ? m.payload.commitmentId : "";

const compact = ({
  fromAgentId,
  toAgentId,
  purpose,
  payload,
}: AgentMessage) => ({
  from: fromAgentId,
  to: toAgentId,
  purpose,
  payload,
});

/** Offers received that this agent has not yet answered or acted on. */
const pendingOffers = (agent: AgentState) => {
  const answered = new Set(agent.outbox.map(commitmentOf));
  return agent.inbox
    .filter((m) => m.purpose === "offer" && !answered.has(commitmentOf(m)))
    .map(compact);
};

/** Recent messages about commitments, so a later turn can pick a thread up. */
const commitmentHistory = (agent: AgentState) =>
  [...agent.inbox, ...agent.outbox]
    .filter((m) => commitmentOf(m) !== "")
    .toSorted((a, b) => a.sentAt - b.sentAt)
    .slice(-TURN_COMMITMENT_MESSAGES)
    .map(compact);

/**
 * System and user messages for one tool-calling turn. JSON is compact to keep
 * the per-run token budget for decisions rather than whitespace.
 */
export const buildTurnMessages = (
  { agent, observation, inbox, stateVersion, logicalTime }: TurnInput,
  { roster, scenarioFacts }: TurnContext,
): TurnMessage[] => [
  {
    role: "system",
    content: `${TOOL_CALLING_SYSTEM_PROMPT}\n\n${AGENT_ROLE_INSTRUCTIONS[agent.role]}`,
  },
  {
    role: "user",
    content: `AGENT IDENTITY:
- Agent ID: ${agent.id}
- Role: ${agent.role}
- Assigned entity: ${agent.assignedEntityId}

COUNTERPARTS:
${roster
  .filter((a) => a.id !== agent.id)
  .map((a) => `- ${a.id}: ${a.role}, assigned ${a.assignedEntityId}`)
  .join("\n")}

SCENARIO FACTS:
${JSON.stringify(scenarioFacts)}

CLOCK:
- logical time: ${logicalTime}
- state version: ${stateVersion}

GOALS:
${JSON.stringify(agent.goals)}

CURRENT OBLIGATIONS:
${JSON.stringify(agent.obligations)}

CURRENT LOCAL OBSERVATION:
${JSON.stringify(observation)}

OFFERS TO YOU NOT YET ANSWERED:
${JSON.stringify(pendingOffers(agent))}

RECENT COMMITMENT MESSAGES (sent and received, oldest first):
${JSON.stringify(commitmentHistory(agent))}

NEW MESSAGES SINCE YOUR LAST TURN:
${JSON.stringify(inbox)}

RECENT LOCAL MEMORY:
${JSON.stringify(agent.memory.slice(-TURN_MEMORY_ITEMS))}

Decide this turn's single tool call.`,
  },
];
