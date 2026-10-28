import { describe, expect, it } from "vitest";
import type { AgentRole, AgentState, AgentToolCall } from "../agents/types";
import type { CommitmentEntity, EngineSnapshot } from "../engine/types";
import { authorize } from "./authorize";

const makeAgent = (
  id: string,
  role: AgentRole,
  assignedEntityId: string,
): AgentState => ({
  id,
  role,
  name: id,
  assignedEntityId,
  goals: [],
  obligations: [],
  inbox: [],
  outbox: [],
  memory: [],
  fallbackCounter: 0,
});

const driver = makeAgent("DRV-047", "driver", "T-2291");
const dockLead = makeAgent("DOCK-C", "dock_lead", "D-108");
const yard = makeAgent("YARD-1", "yard_controller", "YT-2");
const supervisor = makeAgent("SUP-1", "supervisor", "FACILITY");

const commitment = (
  id: string,
  status: CommitmentEntity["status"],
  agentIds: string[],
  resources: CommitmentEntity["requiredResources"],
): CommitmentEntity => ({
  id,
  task: "synthetic test task",
  status,
  participants: agentIds.map((agentId) => ({
    agentId,
    role: "x",
    accepted: true,
  })),
  requiredResources: resources,
  createdAt: 0,
  expiresAt: 1000,
  stateVersion: 1,
});

const snapshot: EngineSnapshot = {
  logicalTime: 0,
  stateVersion: 1,
  eventCount: 0,
  state: {
    docks: [
      ["D-108", { id: "D-108", kind: "dock", status: "occupied" }],
      ["D-112", { id: "D-112", kind: "dock", status: "reserved" }],
      ["D-200", { id: "D-200", kind: "dock", status: "free" }],
    ],
    stalls: [["S-1", { id: "S-1" }]],
    trailers: [
      [
        "T-2291",
        {
          id: "T-2291",
          location: { kind: "dock", dockId: "D-112" },
          cargo: [],
          doorOpen: true,
          status: "serving",
        },
      ],
      [
        "T-9",
        {
          id: "T-9",
          location: { kind: "dock", dockId: "D-200" },
          cargo: [],
          doorOpen: true,
          status: "serving",
        },
      ],
    ],
    tractors: [
      ["YT-2", { id: "YT-2", role: "yard", status: "idle" }],
      ["YT-3", { id: "YT-3", role: "yard", status: "idle" }],
      ["RT-1", { id: "RT-1", role: "road", status: "idle" }],
    ],
    equipment: [],
    workers: [],
    shipments: [],
    commitments: [
      [
        "C-1",
        commitment(
          "C-1",
          "committed",
          ["DOCK-C", "DRV-047"],
          [
            {
              resourceId: "D-112",
              type: "dock",
              startWindow: 0,
              endWindow: 10,
            },
          ],
        ),
      ],
      [
        "C-2",
        commitment(
          "C-2",
          "committed",
          ["YARD-1"],
          [
            {
              resourceId: "YT-2",
              type: "tractor",
              startWindow: 0,
              endWindow: 10,
            },
          ],
        ),
      ],
    ],
  },
};

const res = (resourceId: string, type: string) => ({
  resourceId,
  type,
  startWindow: 0,
  endWindow: 10,
});

const propose = (resources: ReturnType<typeof res>[]): AgentToolCall => ({
  tool: "propose",
  parameters: {
    task: "t",
    requiredResources: resources,
    expiresAt: 100,
    participants: [{ agentId: "DOCK-C", role: "dock_lead" }],
  },
});

const denied = (agent: AgentState, call: AgentToolCall) => {
  const r = authorize(agent, call, snapshot);
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.reasonCode).toBe("PERMISSION_DENIED");
    expect(r.message.length).toBeGreaterThan(0);
  }
};
const allowed = (agent: AgentState, call: AgentToolCall) =>
  expect(authorize(agent, call, snapshot)).toEqual({ ok: true });

const commit = (commitmentId: string): AgentToolCall => ({
  tool: "commit",
  parameters: { commitmentId, requestId: "R-1" },
});
const move = (tractorId?: string): AgentToolCall => ({
  tool: "executeMove",
  parameters: {
    trailerId: "T-2291",
    targetLocation: { kind: "stall", stallId: "S-1" },
    ...(tractorId ? { tractorId } : {}),
  },
});
const unload = (trailerId: string): AgentToolCall => ({
  tool: "executeUnload",
  parameters: { trailerId, shipmentId: "SH-1", quantity: 5 },
});
const cancel = (commitmentId: string): AgentToolCall => ({
  tool: "cancel",
  parameters: { commitmentId, reason: "r" },
});
const accept = (participantId: string): AgentToolCall => ({
  tool: "accept",
  parameters: { participantId, commitmentId: "C-1", acceptedAtVersion: 1 },
});
const inject: AgentToolCall = {
  tool: "injectDisruption",
  parameters: { disruptionId: "H-2", type: "dock_closure", targetId: "D-112" },
};

describe("authorize: denied cells", () => {
  it("driver cannot propose for another trailer", () =>
    denied(driver, propose([res("T-9", "trailer")])));
  it("driver cannot propose docks", () =>
    denied(driver, propose([res("D-112", "dock")])));
  it("dock lead cannot propose stalls", () =>
    denied(dockLead, propose([res("S-1", "stall")])));
  it("yard controller cannot propose docks", () =>
    denied(yard, propose([res("D-112", "dock")])));
  it("yard controller cannot propose a road tractor", () =>
    denied(yard, propose([res("RT-1", "tractor")])));
  it("driver cannot commit", () => denied(driver, commit("C-1")));
  it("dock lead cannot commit when not a participant", () =>
    denied(dockLead, commit("C-2")));
  it("yard controller cannot commit when not a participant", () =>
    denied(yard, commit("C-1")));
  it("driver cannot executeMove", () => denied(driver, move("YT-2")));
  it("dock lead cannot executeMove", () => denied(dockLead, move("YT-2")));
  it("supervisor cannot executeMove", () => denied(supervisor, move("YT-2")));
  it("yard controller cannot move without a committed yard tractor", () => {
    denied(yard, move());
    denied(yard, move("YT-3"));
    denied(yard, move("RT-1"));
  });
  it("driver cannot executeUnload", () => denied(driver, unload("T-2291")));
  it("yard controller cannot executeUnload", () =>
    denied(yard, unload("T-2291")));
  it("supervisor cannot executeUnload", () =>
    denied(supervisor, unload("T-2291")));
  it("dock lead cannot unload at docks it does not own", () =>
    denied(dockLead, unload("T-9")));
  it("driver cannot cancel others' commitments", () =>
    denied(driver, cancel("C-2")));
  it("dock lead cannot cancel others' commitments", () =>
    denied(dockLead, cancel("C-2")));
  it("yard controller cannot cancel others' commitments", () =>
    denied(yard, cancel("C-1")));
  it("driver may accept for itself but not for DOCK-C", () => {
    allowed(driver, accept("DRV-047"));
    denied(driver, accept("DOCK-C"));
  });
  it("supervisor cannot accept for another agent", () =>
    denied(supervisor, accept("DOCK-C")));
  it.each([
    driver,
    dockLead,
    yard,
    supervisor,
  ])("$role cannot injectDisruption", (agent) => denied(agent, inject));
  it("denies malformed parameters", () =>
    denied(dockLead, { tool: "commit", parameters: {} }));
});

describe("authorize: allowed paths", () => {
  it("driver proposes for its own trailer", () =>
    allowed(driver, propose([res("T-2291", "trailer")])));
  it("dock lead proposes docks", () =>
    allowed(dockLead, propose([res("D-112", "dock")])));
  it("yard controller proposes stalls and yard tractors", () =>
    allowed(yard, propose([res("S-1", "stall"), res("YT-2", "tractor")])));
  it("supervisor proposes anything", () =>
    allowed(supervisor, propose([res("S-1", "stall"), res("D-1", "dock")])));
  it("participants commit; supervisor commits any", () => {
    allowed(dockLead, commit("C-1"));
    allowed(yard, commit("C-2"));
    allowed(supervisor, commit("C-2"));
  });
  it("yard controller moves with a committed yard tractor", () =>
    allowed(yard, move("YT-2")));
  it("dock lead unloads at a committed dock", () =>
    allowed(dockLead, unload("T-2291")));
  it("participants cancel own commitments; supervisor any", () => {
    allowed(dockLead, cancel("C-1"));
    allowed(driver, cancel("C-1"));
    allowed(supervisor, cancel("C-2"));
  });
  it("everyone may escalate and observe", () => {
    for (const a of [driver, dockLead, yard, supervisor]) {
      allowed(a, {
        tool: "escalate",
        parameters: {
          reason: "r",
          participants: ["SUP-1"],
          unresolvedChoices: ["x"],
        },
      });
      allowed(a, {
        tool: "observe",
        parameters: { role: "driver", agentEntityId: "T-2291" },
      });
    }
  });
});
