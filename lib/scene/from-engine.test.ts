import { describe, expect, it } from "vitest";
import { SimulationEngine } from "@/lib/engine/engine";
import type { TrailerEntity } from "@/lib/engine/types";
import { S1 } from "./facility";
import { keepSameScene, sceneStateFromEngine } from "./from-engine";
import { buildLayout, movingPair } from "./layout";

const engineWithT2291 = (): SimulationEngine => {
  const engine = new SimulationEngine();
  engine.addTrailer({
    id: "T-2291",
    location: { kind: "dock", dockId: "D-108" },
    cargo: [{ shipmentId: "SH-5512", quantity: 22 }],
    doorOpen: true,
    status: "serving",
  });
  engine.addTractor({ id: "YT-2", role: "yard", status: "idle" });
  engine.addEquipment({ id: "F-07", type: "forklift", status: "working" });
  return engine;
};

const trailerAt = (
  id: string,
  location: TrailerEntity["location"],
): TrailerEntity => ({
  id,
  location,
  cargo: [],
  doorOpen: false,
  status: "parked",
});

describe("sceneStateFromEngine", () => {
  it("keeps the 182/4/235 S1 identities for any snapshot", () => {
    const empty = sceneStateFromEngine(
      new SimulationEngine({ dockCount: 0, stallCount: 0 }).createCheckpoint(),
    );
    for (const s of [
      empty,
      sceneStateFromEngine(engineWithT2291().createCheckpoint()),
    ]) {
      expect(s.doors).toHaveLength(S1.dockDoors);
      expect(s.ramps).toHaveLength(S1.rampDoors);
      expect(s.stalls).toHaveLength(S1.trailerSpaces);
    }
    expect(empty.trailers).toEqual([]);
  });

  it("renders a door the engine closed as closed", () => {
    const engine = engineWithT2291();
    engine.injectDisruption("H-1", "dock_closure", "D-108");
    const door = sceneStateFromEngine(engine.createCheckpoint()).doors.find(
      (d) => d.id === "D-108",
    );
    expect(door?.status).toBe("closed");
    expect(door?.trailer).toBe("T-2291");
  });

  it("renders an occupied dock as serving and an unmentioned door as free", () => {
    const s = sceneStateFromEngine(engineWithT2291().createCheckpoint());
    expect(s.doors.find((d) => d.id === "D-108")?.status).toBe("serving");
    expect(s.doors.find((d) => d.id === "D-112")?.status).toBe("free");
    expect(s.trailers).toEqual([
      { id: "T-2291", kind: "trailer", status: "serving", at: "D-108" },
    ]);
  });

  it("renders a trailer in transit as moving between its doors", () => {
    const snap = engineWithT2291().createCheckpoint();
    const moved = {
      ...snap,
      state: {
        ...snap.state,
        trailers: snap.state.trailers.map(
          ([id, t]): (typeof snap.state.trailers)[number] => [
            id,
            {
              ...t,
              location: { kind: "in_transit", from: "D-108", to: "D-112" },
            },
          ],
        ),
      },
    };
    const s = sceneStateFromEngine(moved);
    expect(s.trailers[0]).toMatchObject({
      status: "moving",
      at: "D-108→D-112",
    });
    expect(movingPair(s)).toEqual(["D-108", "D-112"]);
    expect(() => buildLayout(s, ["D-108", "D-112"])).not.toThrow();
  });

  it("leaves out a trailer in transit off the doors instead of guessing a spot", () => {
    const engine = engineWithT2291();
    engine.addTrailer(
      trailerAt("T-5", { kind: "in_transit", from: "P-001", to: "D-112" }),
    );
    engine.addTrailer(
      trailerAt("T-6", { kind: "in_transit", from: "D-108", to: "gate" }),
    );
    const s = sceneStateFromEngine(engine.createCheckpoint());
    expect(s.trailers.map((t) => t.id)).toEqual(["T-2291"]);
  });

  it("places each trailer in transit between its own doors", () => {
    const engine = new SimulationEngine();
    engine.addTrailer(
      trailerAt("T-5", { kind: "in_transit", from: "D-100", to: "D-104" }),
    );
    engine.addTrailer(
      trailerAt("T-6", { kind: "in_transit", from: "D-120", to: "D-130" }),
    );
    const s = sceneStateFromEngine(engine.createCheckpoint());
    const layout = buildLayout(s, ["D-108", "D-112"]);
    const [a, b] = ["T-5", "T-6"].map((id) => layout.get(id));
    if (!a || !b) throw new Error("missing placement");
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(100);
  });

  it("derives a trailer's scene status from its location, not a stale engine status", () => {
    const engine = new SimulationEngine();
    engine.addTrailer({
      ...trailerAt("T-1", { kind: "stall", stallId: "P-001" }),
      status: "gate",
    });
    engine.addTrailer({
      ...trailerAt("T-2", { kind: "dock", dockId: "D-001" }),
      status: "moving",
    });
    engine.addTrailer({
      ...trailerAt("T-3", { kind: "dock", dockId: "D-002" }),
      status: "blocked",
    });
    engine.addTrailer({
      ...trailerAt("T-4", { kind: "stall", stallId: "P-002" }),
      status: "waiting",
    });
    engine.addTrailer({
      ...trailerAt("T-5", { kind: "gate", queueIndex: 0 }),
      status: "parked",
    });
    const status = new Map(
      sceneStateFromEngine(engine.createCheckpoint()).trailers.map((t) => [
        t.id,
        t.status,
      ]),
    );
    expect(Object.fromEntries(status)).toEqual({
      "T-1": "parked",
      "T-2": "serving",
      "T-3": "blocked",
      "T-4": "waiting",
      "T-5": "gate",
    });
  });

  it("renders ramps with the engine's status", () => {
    const engine = engineWithT2291();
    engine.injectDisruption("H-3", "dock_closure", "R-02");
    const s = sceneStateFromEngine(engine.createCheckpoint());
    expect(s.ramps.map((r) => r.status)).toEqual([
      "free",
      "closed",
      "free",
      "free",
    ]);
  });

  it("parks loose yard tractors first, in id order", () => {
    const engine = new SimulationEngine();
    for (const [id, role] of [
      ["YT-9", "yard"],
      ["RT-1", "road"],
      ["YT-3", "yard"],
    ] as const) {
      engine.addTractor({ id, role, status: "idle" });
    }
    const park = Object.fromEntries(
      sceneStateFromEngine(engine.createCheckpoint()).tractors.map((t) => [
        t.id,
        t.parkIndex,
      ]),
    );
    expect(park).toEqual({ "YT-3": 0, "YT-9": 1, "RT-1": 2 });
  });

  it("leaves out trailers it has no spot for instead of guessing one", () => {
    const snap = engineWithT2291().createCheckpoint();
    const odd = {
      ...snap,
      state: {
        ...snap.state,
        trailers: [
          ...snap.state.trailers,
          [
            "T-1",
            {
              ...snap.state.trailers[0][1],
              id: "T-1",
              location: { kind: "coupled", tractorId: "YT-2" },
            },
          ],
          [
            "T-2",
            {
              ...snap.state.trailers[0][1],
              id: "T-2",
              location: { kind: "dock", dockId: "D-999" },
            },
          ],
          [
            "T-3",
            {
              ...snap.state.trailers[0][1],
              id: "T-3",
              location: { kind: "yard_lane", laneId: "L1" },
            },
          ],
        ] satisfies typeof snap.state.trailers,
      },
    };
    const s = sceneStateFromEngine(odd);
    expect(s.trailers.map((t) => t.id)).toEqual(["T-2291"]);
  });

  it("keeps engine ids and statuses for tractors and forklifts", () => {
    const engine = engineWithT2291();
    engine.injectDisruption("H-2", "equipment_failure", "F-07");
    const s = sceneStateFromEngine(engine.createCheckpoint());
    expect(s.tractors).toEqual([
      {
        id: "YT-2",
        kind: "tractor",
        role: "yard",
        status: "idle",
        parkIndex: 0,
      },
    ]);
    expect(s.forklifts).toEqual([
      { id: "F-07", kind: "forklift", index: 0, status: "failed" },
    ]);
    expect(() => buildLayout(s, ["D-108", "D-112"])).not.toThrow();
  });
});

describe("keepSameScene", () => {
  it("keeps the previous state when a new snapshot changed nothing the scene draws", () => {
    const engine = engineWithT2291();
    const first = sceneStateFromEngine(engine.createCheckpoint());
    const again = sceneStateFromEngine(engine.createCheckpoint());
    expect(again).not.toBe(first);
    expect(keepSameScene(first, again)).toBe(first);
  });

  it("takes the new state when something changed, or when there was none", () => {
    const engine = engineWithT2291();
    const before = sceneStateFromEngine(engine.createCheckpoint());
    engine.injectDisruption("H-1", "dock_closure", "D-108");
    const after = sceneStateFromEngine(engine.createCheckpoint());
    expect(keepSameScene(before, after)).toBe(after);
    expect(keepSameScene(undefined, after)).toBe(after);
  });
});
