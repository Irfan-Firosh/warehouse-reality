import { beforeEach, describe, expect, it } from "vitest";
import { SimulationEngine } from "../../engine/engine";
import { D108, seedD108 } from "./d108";

describe("seedD108", () => {
  let engine: SimulationEngine;

  beforeEach(() => {
    engine = new SimulationEngine();
    seedD108(engine);
  });

  it("seeds T-2291 at D-108 with SH-5512 22 pallets, 9 transferred", () => {
    const trailer = engine.getTrailer(D108.trailer);
    expect(trailer?.location).toEqual({
      kind: "dock",
      dockId: D108.closedDock,
    });
    expect(trailer?.cargo).toEqual([
      { shipmentId: D108.shipment, quantity: 22 },
    ]);
    expect(engine.getDock(D108.closedDock)?.occupiedTrailerId).toBe(
      D108.trailer,
    );
    const shipment = engine
      .createCheckpoint()
      .state.shipments.find(([id]) => id === D108.shipment)?.[1];
    expect(shipment?.totalQuantity).toBe(22);
    expect(shipment?.transferredQuantity).toBe(9);
  });

  it("leaves D-112 free", () => {
    const dock = engine.getDock(D108.targetDock);
    expect(dock?.status).toBe("free");
    expect(dock?.occupiedTrailerId).toBeUndefined();
  });

  it("YT-2 is an idle yard tractor and F-07 a working forklift", () => {
    const { tractors, equipment } = engine.createCheckpoint().state;
    expect(tractors.find(([id]) => id === "YT-2")?.[1]).toMatchObject({
      role: "yard",
      status: "idle",
    });
    expect(equipment.find(([id]) => id === "F-07")?.[1]).toMatchObject({
      type: "forklift",
      status: "working",
    });
  });

  it("contender T-3061 waits in stall P-061", () => {
    expect(engine.getTrailer(D108.contender)?.location).toEqual({
      kind: "stall",
      stallId: "P-061",
    });
    expect(engine.getStall("P-061")?.occupiedTrailerId).toBe(D108.contender);
  });

  it("all seeded values are scenario values (no DFW claim)", () => {
    const events = engine
      .getEventLog()
      .filter((e) => e.type === "scenario_seeded");
    expect(events).toHaveLength(1);
    expect(events[0]?.payload?.provenance).toBe("scenario");
  });
});
