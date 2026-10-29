import { describe, expect, it } from "vitest";
import { ILLUSTRATIVE_STATE } from "@/lib/scene/illustrative-state";
import {
  calculateDashboardCounts,
  DEPENDENCIES,
  EVIDENCE_RECORDS,
  getEntitiesForFilter,
  UNKNOWN_DFW_FIELDS,
} from "./data";

describe("Dashboard Data & Accounting", () => {
  it("calculates live occupancy counts matching S1 physical capacities", () => {
    const counts = calculateDashboardCounts();
    expect(counts.doorsOccupied).toBeGreaterThan(0);
    expect(counts.doorsOccupied).toBeLessThanOrEqual(182);
    expect(counts.stallsOccupied).toBeGreaterThan(0);
    expect(counts.stallsOccupied).toBeLessThanOrEqual(235);
    expect(counts.doorsServing + counts.doorsBlocked).toBe(
      counts.doorsOccupied,
    );
    expect(counts.outboundBlocked).toBe(DEPENDENCIES.length);
  });

  it("filters entities accurately by kind", () => {
    const doors = getEntitiesForFilter("doors", ILLUSTRATIVE_STATE);
    expect(doors.length).toBe(186); // 182 dock doors + 4 ramps

    const stalls = getEntitiesForFilter("stalls", ILLUSTRATIVE_STATE);
    expect(stalls.length).toBe(235); // S1 trailer spaces

    const trailers = getEntitiesForFilter("trailers", ILLUSTRATIVE_STATE);
    expect(trailers.length).toBeGreaterThan(0);

    const equipment = getEntitiesForFilter("equipment", ILLUSTRATIVE_STATE);
    expect(equipment.length).toBeGreaterThan(0);
  });

  it("registers all 14 unknown DFW fields per PRD §4.2", () => {
    expect(UNKNOWN_DFW_FIELDS).toHaveLength(14);
    expect(UNKNOWN_DFW_FIELDS).toContain("daily truck visits");
    expect(UNKNOWN_DFW_FIELDS).toContain("trailer occupancy");
    expect(UNKNOWN_DFW_FIELDS).toContain("forklifts");
    expect(UNKNOWN_DFW_FIELDS).toContain("yard tractors");
    expect(UNKNOWN_DFW_FIELDS).toContain("operating priorities");
  });

  it("includes immutable provenance records for derived and published data", () => {
    const derivedTrips = EVIDENCE_RECORDS.find((r) => r.id === "EV-01");
    expect(derivedTrips).toBeDefined();
    expect(derivedTrips?.kind).toBe("drv");
    expect(derivedTrips?.formula).toContain("0.233");

    const dockSpecs = EVIDENCE_RECORDS.find((r) => r.id === "EV-02");
    expect(dockSpecs).toBeDefined();
    expect(dockSpecs?.kind).toBe("src");
    expect(dockSpecs?.source).toContain("dfwcommercecenter.com");
  });
});
