import { beforeEach, describe, expect, it } from "vitest";
import { SimulationEngine } from "./engine";
import {
  SYNTHETIC_FORKLIFT_1,
  SYNTHETIC_SHIPMENT_1,
  SYNTHETIC_TRACTOR_1,
  SYNTHETIC_TRAILER_1,
  SYNTHETIC_TRAILER_2,
  SYNTHETIC_WORKER_1,
} from "./synthetic-fixtures";

describe("Authoritative Simulation Engine & Physical Invariants", () => {
  let engine: SimulationEngine;

  beforeEach(() => {
    engine = new SimulationEngine({
      startTime: 50400, // 14:00:00
      dockCount: 182,
      rampCount: 4,
      stallCount: 235,
    });
    engine.addTrailer({ ...SYNTHETIC_TRAILER_1 });
    engine.addTrailer({ ...SYNTHETIC_TRAILER_2 });
    engine.addTractor({ ...SYNTHETIC_TRACTOR_1 });
    engine.addEquipment({ ...SYNTHETIC_FORKLIFT_1 });
    engine.addWorker({ ...SYNTHETIC_WORKER_1 });
    engine.addShipment({ ...SYNTHETIC_SHIPMENT_1 });
  });

  describe("Capacity & Physical Invariants (PRD §11.2, §18 P01–P05)", () => {
    it("initializes with exact S1 capacities", () => {
      expect(engine.getDock("D-182")).toBeDefined();
      expect(engine.getDock("D-183")).toBeUndefined();
      expect(engine.getDock("R-04")).toBeDefined();
      expect(engine.getStall("P-235")).toBeDefined();
      expect(engine.getStall("P-236")).toBeUndefined();
    });

    it("P01: preserves single physical location for each trailer", () => {
      // D-001 is already occupied by T-SYN-01
      // Attempting to move T-SYN-02 into D-001 must be rejected
      const moveRes = engine.executeMove("T-SYN-02", {
        kind: "dock",
        dockId: "D-001",
      });
      expect(moveRes.success).toBe(false);
      expect(moveRes.reasonCode).toBe("RESOURCE_UNAVAILABLE");
      expect(moveRes.message).toContain("already occupied");

      // Moving to a free dock succeeds and frees the old stall
      const validMove = engine.executeMove("T-SYN-02", {
        kind: "dock",
        dockId: "D-002",
      });
      expect(validMove.success).toBe(true);
      expect(engine.getTrailer("T-SYN-02")?.location).toEqual({
        kind: "dock",
        dockId: "D-002",
      });
      expect(engine.getStall("P-001")?.occupiedTrailerId).toBeUndefined();
      expect(engine.getDock("D-002")?.occupiedTrailerId).toBe("T-SYN-02");
    });

    it("P03: rejects movement into a closed dock door", () => {
      engine.injectDisruption("H-1", "dock_closure", "D-005");
      expect(engine.getDock("D-005")?.status).toBe("closed");

      const moveRes = engine.executeMove("T-SYN-02", {
        kind: "dock",
        dockId: "D-005",
      });
      expect(moveRes.success).toBe(false);
      expect(moveRes.reasonCode).toBe("RESOURCE_UNAVAILABLE");
      expect(moveRes.message).toContain("closed");
    });

    it("P02: enforces cargo quantity conservation and survives interruption", () => {
      // Unload 8 of 20 pallets
      const unload1 = engine.executeUnload("T-SYN-01", "SH-SYN-01", 8);
      expect(unload1.success).toBe(true);

      const trailerAfter1 = engine.getTrailer("T-SYN-01");
      expect(trailerAfter1?.cargo[0].quantity).toBe(12);

      // Attempting to unload 15 pallets when only 12 remain must violate P02 conservation
      const excessUnload = engine.executeUnload("T-SYN-01", "SH-SYN-01", 15);
      expect(excessUnload.success).toBe(false);
      expect(excessUnload.reasonCode).toBe("INVARIANT_VIOLATION");
      expect(excessUnload.message).toContain("conservation violation");

      // Verify partial work survived and on-board quantity remained 12
      expect(engine.getTrailer("T-SYN-01")?.cargo[0].quantity).toBe(12);
    });
  });

  describe("Commitment Lifecycle & Atomic Two-Phase Locking (PRD §9, §10, §18 C01–C06)", () => {
    it("C01: partial acceptances do not lock exclusive resources", () => {
      const propRes = engine.propose({
        id: "C-TEST-01",
        task: "Relocate T-SYN-01 to D-010",
        participants: [
          { agentId: "DRV-01", role: "driver" },
          { agentId: "DOCK-LEAD-1", role: "dock_lead" },
        ],
        requiredResources: [
          {
            resourceId: "D-010",
            type: "dock",
            startWindow: 51000,
            endWindow: 52000,
          },
        ],
        expiresInSeconds: 600,
      });
      expect(propRes.success).toBe(true);

      // Driver accepts
      const acc1 = engine.accept("DRV-01", "C-TEST-01", 1);
      expect(acc1.success).toBe(true);
      expect(engine.getCommitment("C-TEST-01")?.status).toBe(
        "partially_accepted",
      );

      // Resource D-010 must still be free (not reserved)
      expect(engine.getDock("D-010")?.reservedCommitmentId).toBeUndefined();
    });

    it("C02: complete commitment atomically acquires all required resources", () => {
      engine.propose({
        id: "C-TEST-02",
        task: "Relocate to D-012 with Forklift F-SYN-01",
        participants: [
          { agentId: "DRV-01", role: "driver" },
          { agentId: "DOCK-LEAD-1", role: "dock_lead" },
        ],
        requiredResources: [
          {
            resourceId: "D-012",
            type: "dock",
            startWindow: 51000,
            endWindow: 52000,
          },
          {
            resourceId: "F-SYN-01",
            type: "equipment",
            startWindow: 51000,
            endWindow: 52000,
          },
        ],
        expiresInSeconds: 600,
      });

      const v = engine.getStateVersion();
      engine.accept("DRV-01", "C-TEST-02", v);
      engine.accept("DOCK-LEAD-1", "C-TEST-02", v);

      const commitRes = engine.commit("C-TEST-02", "REQ-001");
      expect(commitRes.success).toBe(true);
      expect(engine.getCommitment("C-TEST-02")?.status).toBe("committed");

      // Verify all required resources are locked atomically
      expect(engine.getDock("D-012")?.reservedCommitmentId).toBe("C-TEST-02");
      expect(commitRes.affectedIds).toContain("C-TEST-02");
    });

    it("C03: simultaneous contending requests cannot double-book exclusive resources", () => {
      // Propose commitment A for D-015
      engine.propose({
        id: "C-A",
        task: "Book D-015",
        participants: [{ agentId: "DRV-A", role: "driver" }],
        requiredResources: [
          {
            resourceId: "D-015",
            type: "dock",
            startWindow: 51000,
            endWindow: 52000,
          },
        ],
        expiresInSeconds: 600,
      });

      // Propose commitment B for the exact same D-015
      engine.propose({
        id: "C-B",
        task: "Book D-015",
        participants: [{ agentId: "DRV-B", role: "driver" }],
        requiredResources: [
          {
            resourceId: "D-015",
            type: "dock",
            startWindow: 51000,
            endWindow: 52000,
          },
        ],
        expiresInSeconds: 600,
      });

      const v = engine.getStateVersion();
      engine.accept("DRV-A", "C-A", v);
      engine.accept("DRV-B", "C-B", v);

      // Commitment A commits first, advancing state version
      const commitA = engine.commit("C-A", "REQ-A");
      expect(commitA.success).toBe(true);

      // Commitment B was accepted against previous version, so it is rejected with STALE_VERSION (C05)
      const commitB1 = engine.commit("C-B", "REQ-B1");
      expect(commitB1.success).toBe(false);
      expect(commitB1.reasonCode).toBe("STALE_VERSION");

      // Agent B revises and proposes candidate C-B2 at current version
      engine.propose({
        id: "C-B2",
        task: "Book D-015 (Revised proposal)",
        participants: [{ agentId: "DRV-B", role: "driver" }],
        requiredResources: [
          {
            resourceId: "D-015",
            type: "dock",
            startWindow: 51000,
            endWindow: 52000,
          },
        ],
        expiresInSeconds: 600,
      });
      engine.accept("DRV-B", "C-B2", engine.getStateVersion());
      const commitB2 = engine.commit("C-B2", "REQ-B2");
      expect(commitB2.success).toBe(false);
      expect(commitB2.reasonCode).toBe("RESOURCE_UNAVAILABLE");
      expect(commitB2.message).toContain("already reserved");
    });

    it("C04: duplicate request IDs return idempotent result without duplicating reservations", () => {
      engine.propose({
        id: "C-IDEM",
        task: "Idempotent Task",
        participants: [{ agentId: "DRV-01", role: "driver" }],
        requiredResources: [
          {
            resourceId: "D-020",
            type: "dock",
            startWindow: 51000,
            endWindow: 52000,
          },
        ],
        expiresInSeconds: 600,
      });

      const v = engine.getStateVersion();
      engine.accept("DRV-01", "C-IDEM", v);

      const res1 = engine.commit("C-IDEM", "REQ-STABLE-ID-123");
      const vAfter = engine.getStateVersion();
      expect(res1.success).toBe(true);

      // Retry with the exact same request ID
      const res2 = engine.commit("C-IDEM", "REQ-STABLE-ID-123");
      expect(res2.success).toBe(true);
      // Version and reservations must not duplicate
      expect(engine.getStateVersion()).toBe(vAfter);
    });

    it("C05: stale accepted versions fail with STALE_VERSION", () => {
      engine.propose({
        id: "C-STALE",
        task: "Stale Version Test",
        participants: [{ agentId: "DRV-01", role: "driver" }],
        requiredResources: [
          {
            resourceId: "D-025",
            type: "dock",
            startWindow: 51000,
            endWindow: 52000,
          },
        ],
        expiresInSeconds: 600,
      });

      // Driver accepted at version 1
      engine.accept("DRV-01", "C-STALE", 1);

      // Physical state advances due to unrelated move
      engine.executeMove("T-SYN-02", { kind: "dock", dockId: "D-050" });
      expect(engine.getStateVersion()).toBeGreaterThan(1);

      // Attempting to commit with stale accepted version fails
      const commitRes = engine.commit("C-STALE", "REQ-STALE");
      expect(commitRes.success).toBe(false);
      expect(commitRes.reasonCode).toBe("STALE_VERSION");
      expect(commitRes.message).toContain("STALE_VERSION");
    });
  });

  describe("Checkpoints and Replay (PRD §14, §16, R01)", () => {
    it("creates checkpoints and restores identical state", () => {
      const checkpoint = engine.createCheckpoint();

      // Perform mutations
      engine.executeMove("T-SYN-02", { kind: "dock", dockId: "D-030" });
      expect(engine.getTrailer("T-SYN-02")?.location).toEqual({
        kind: "dock",
        dockId: "D-030",
      });

      // Restore checkpoint
      engine.restoreCheckpoint(checkpoint);
      expect(engine.getTrailer("T-SYN-02")?.location).toEqual({
        kind: "stall",
        stallId: "P-001",
      });
      expect(engine.getDock("D-030")?.occupiedTrailerId).toBeUndefined();
    });
  });

  describe("Engine clock and full checkpoints", () => {
    const sched = (e: SimulationEngine, id: string, t: number) =>
      e.scheduleEvent({
        id,
        logicalTime: t,
        type: "TEST",
        affectedIds: [],
        stateVersion: 0,
      });

    it("advanceUntil consumes queued events in time order and never moves time backwards", () => {
      sched(engine, "E-LATE", 50700);
      sched(engine, "E-EARLY", 50500);
      sched(engine, "E-BEYOND", 51000);

      const consumed = engine.advanceUntil(50800);
      expect(consumed.map((e) => e.id)).toEqual(["E-EARLY", "E-LATE"]);
      expect(engine.getLogicalTime()).toBe(50800);

      // Earlier target must not rewind time or consume anything
      expect(engine.advanceUntil(50600)).toEqual([]);
      expect(engine.getLogicalTime()).toBe(50800);

      // The beyond-target event is still queued
      expect(engine.advanceUntil(51000).map((e) => e.id)).toEqual(["E-BEYOND"]);
    });

    it("advanceUntil with an empty queue still sets logicalTime", () => {
      expect(engine.advanceUntil(51234)).toEqual([]);
      expect(engine.getLogicalTime()).toBe(51234);
    });

    it("restore(checkpoint) then the same commit requestId returns the stored result", () => {
      engine.propose({
        id: "C-RESTORE",
        task: "Restore Idempotency",
        participants: [{ agentId: "DRV-01", role: "driver" }],
        requiredResources: [
          {
            resourceId: "D-020",
            type: "dock",
            startWindow: 51000,
            endWindow: 52000,
          },
        ],
        expiresInSeconds: 600,
      });
      engine.accept("DRV-01", "C-RESTORE", engine.getStateVersion());
      const first = engine.commit("C-RESTORE", "REQ-RESTORE");
      expect(first.success).toBe(true);
      sched(engine, "E-QUEUED", 60000);

      const checkpoint = engine.createCheckpoint();
      expect(checkpoint.sequence).toBeGreaterThan(0);
      expect(checkpoint.queue.map((e) => e.id)).toEqual(["E-QUEUED"]);

      const fresh = new SimulationEngine({ startTime: 50400 });
      fresh.restoreCheckpoint(checkpoint);
      const versionAfterRestore = fresh.getStateVersion();
      const second = fresh.commit("C-RESTORE", "REQ-RESTORE");
      expect(second).toEqual(first);
      expect(fresh.getStateVersion()).toBe(versionAfterRestore);
      expect(fresh.advanceUntil(60000).map((e) => e.id)).toEqual(["E-QUEUED"]);
    });
  });
});
