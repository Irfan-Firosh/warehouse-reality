import { describe, expect, it } from "vitest";
import { S1 } from "./facility";
import {
  CLOSED_DOOR,
  entitiesById,
  ILLUSTRATIVE_STATE,
  MOVING_TRAILER,
  TARGET_DOOR,
} from "./illustrative-state";
import { buildLayout, doorSlot, stallSlot } from "./layout";

const state = ILLUSTRATIVE_STATE;
const layout = buildLayout(state, [CLOSED_DOOR, TARGET_DOOR]);

describe("S1 identities (E01)", () => {
  it("has exactly 182 dock-high doors, 4 ramp doors and 235 trailer spaces", () => {
    expect(state.doors).toHaveLength(S1.dockDoors);
    expect(state.ramps).toHaveLength(S1.rampDoors);
    expect(state.stalls).toHaveLength(S1.trailerSpaces);
    expect(S1).toMatchObject({
      dockDoors: 182,
      rampDoors: 4,
      trailerSpaces: 235,
    });
  });

  it("gives every entity a unique id and a placement", () => {
    const all = [
      ...state.doors,
      ...state.ramps,
      ...state.stalls,
      ...state.trailers,
      ...state.tractors,
      ...state.forklifts,
    ];
    expect(entitiesById(state).size).toBe(all.length);
    for (const e of all) expect(layout.has(e.id), e.id).toBe(true);
  });

  it("keeps every door and stall slot on the site, distinct and in order", () => {
    const doorXs = state.doors.map(
      (d) => `${doorSlot(d.index).x},${doorSlot(d.index).z}`,
    );
    const stallXs = state.stalls.map(
      (s) => `${stallSlot(s.index).x},${stallSlot(s.index).z}`,
    );
    expect(new Set(doorXs).size).toBe(S1.dockDoors);
    expect(new Set(stallXs).size).toBe(S1.trailerSpaces);
    for (const d of state.doors)
      expect(Math.abs(doorSlot(d.index).x)).toBeLessThan(S1.length / 2);
  });
});

describe("illustrative state invariants (P01)", () => {
  it("puts at most one trailer at each door and stall", () => {
    const hosts = state.trailers.map((t) => t.at);
    const onSite = hosts.filter(
      (h) => h.startsWith("D-") || h.startsWith("P-"),
    );
    expect(new Set(onSite).size).toBe(onSite.length);
  });

  it("leaves the closed door empty while its trailer is in transit", () => {
    expect(state.trailers.some((t) => t.at === CLOSED_DOOR)).toBe(false);
    expect(state.trailers.find((t) => t.id === MOVING_TRAILER)?.status).toBe(
      "moving",
    );
  });

  it("couples each road tractor to an existing trailer", () => {
    const trailerIds = new Set(state.trailers.map((t) => t.id));
    for (const t of state.tractors.filter((tr) => tr.at)) {
      expect(trailerIds.has(t.at ?? ""), t.id).toBe(true);
    }
  });
});

describe("placement", () => {
  it("faces each coupled tractor away from its trailer", () => {
    for (const t of state.tractors.filter((tr) => tr.at)) {
      const tractor = layout.get(t.id);
      const trailer = layout.get(t.at ?? "");
      if (!tractor || !trailer)
        throw new Error(`missing placement for ${t.id}`);
      const forward = { x: Math.sin(tractor.rotY), z: Math.cos(tractor.rotY) };
      const away = { x: tractor.x - trailer.x, z: tractor.z - trailer.z };
      expect(forward.x * away.x + forward.z * away.z, t.id).toBeGreaterThan(0);
    }
  });

  it("sits the trailer box above the ground", () => {
    const p = layout.get(MOVING_TRAILER);
    expect(p).toBeDefined();
    if (p) expect(p.y - p.size[1] / 2).toBeGreaterThan(0);
  });
});
