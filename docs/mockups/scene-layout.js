// Schematic positions for every entity record (1 unit = 1 ft). Coordinates are
// not surveyed; they only make the S1 counts visible. Pure, no three.js.
import {
  CLOSED_DOOR,
  DOORS_PER_SIDE,
  ENTITIES,
  PROXY,
  S1,
  STALLS_NORTH,
  STATE,
  seeded,
  TARGET_DOOR,
} from "./scene-data.js";

export const HALF_L = S1.length / 2;
export const HALF_D = S1.depth / 2;
const TRAILER_LEN = PROXY.trailer[0];
const TRACTOR_LEN = PROXY.tractor[0];
const HITCH_GAP = 1;
const DOOR_GAP = 4;
const MOVE_LANE = HALF_D + 70;
const GATE_LANE = HALF_D + 100;
const GATE_X0 = -HALF_L - 120;
const GATE_SPACING = 80;
const YT_PARK = { x0: HALF_L - 60, z: HALF_D + 120, spacing: 30 };
const STALL_GAP = 2;

export const doorPos = (i) => {
  const north = i < DOORS_PER_SIDE;
  const k = north ? i : i - DOORS_PER_SIDE;
  const x = -HALF_L + (S1.length / (DOORS_PER_SIDE + 1)) * (k + 1);
  return { x, z: north ? -HALF_D : HALF_D, dir: north ? -1 : 1 };
};

const stallSlot = (k) => {
  const north = k < STALLS_NORTH;
  const count = north ? STALLS_NORTH : S1.trailerSpaces - STALLS_NORTH;
  const kk = north ? k : k - STALLS_NORTH;
  const pitch = S1.length / count;
  const dir = north ? -1 : 1;
  return {
    x: -HALF_L + pitch * (kk + 0.5),
    z: dir * (HALF_D + S1.courtDepth + S1.trailerParkDepth / 2),
    pitch,
  };
};

const RAMP_SLOTS = [
  [-HALF_L, -120],
  [-HALF_L, 120],
  [HALF_L, -120],
  [HALF_L, 120],
];

// Each layout entry: center x/y/z, rotY, and box size [width, height, length]
// on [x, y, z] before rotation; renderers and the highlight both use it.
const doorLayout = (e) => {
  const p = doorPos(e.index);
  return { x: p.x, y: 7, z: p.z + p.dir * 8, rotY: 0, size: [13, 14, 16] };
};
const rampLayout = (e) => {
  const [x, z] = RAMP_SLOTS[e.index];
  return { x: x + Math.sign(x) * 1.5, y: 7, z, rotY: 0, size: [3, 14, 12] };
};
const stallLayout = (e) => {
  const s = stallSlot(e.index);
  return {
    x: s.x,
    y: 0.6,
    z: s.z,
    rotY: 0,
    size: [s.pitch - STALL_GAP, 0.3, S1.trailerParkDepth],
  };
};
const TRAILER_CLEARANCE = 1.5; // ft from ground to the bottom of the chassis
const trailerSize = [PROXY.trailer[2], PROXY.trailer[1], TRAILER_LEN];
const trailerY = PROXY.trailer[1] / 2 + TRAILER_CLEARANCE;

const trailerLayout = (e) => {
  const host = ENTITIES.get(e.at);
  if (host?.kind === "door") {
    const p = doorPos(host.index);
    return {
      x: p.x,
      y: trailerY,
      z: p.z + p.dir * (DOOR_GAP + TRAILER_LEN / 2),
      rotY: 0,
      dir: p.dir,
      size: trailerSize,
    };
  }
  if (host?.kind === "stall") {
    const s = stallSlot(host.index);
    return {
      x: s.x,
      y: trailerY,
      z: s.z,
      rotY: 0,
      dir: Math.sign(s.z),
      size: trailerSize,
    };
  }
  if (e.status === "moving") {
    const from = doorPos(ENTITIES.get(CLOSED_DOOR).index);
    const to = doorPos(ENTITIES.get(TARGET_DOOR).index);
    return {
      x: (from.x + to.x) / 2,
      y: trailerY,
      z: MOVE_LANE,
      rotY: Math.PI / 2,
      size: trailerSize,
    };
  }
  return {
    x: GATE_X0 - e.queueIndex * GATE_SPACING,
    y: trailerY,
    z: GATE_LANE,
    rotY: Math.PI / 2,
    size: trailerSize,
  };
};

const tractorSize = [PROXY.tractor[2], PROXY.tractor[1], TRACTOR_LEN];
const tractorY = PROXY.tractor[1] / 2 + 1;
const HITCH = TRAILER_LEN / 2 + TRACTOR_LEN / 2 + HITCH_GAP;

const tractorLayout = (e, layouts) => {
  const t = layouts.get(e.at);
  if (!t) {
    const x = YT_PARK.x0 - e.parkIndex * YT_PARK.spacing;
    return { x, y: tractorY, z: YT_PARK.z, rotY: 0, size: tractorSize };
  }
  return t.rotY === 0
    ? {
        x: t.x,
        y: tractorY,
        z: t.z + t.dir * HITCH,
        rotY: 0,
        size: tractorSize,
      }
    : { x: t.x + HITCH, y: tractorY, z: t.z, rotY: t.rotY, size: tractorSize };
};

const forkliftSize = [PROXY.forklift[2], PROXY.forklift[1], PROXY.forklift[0]];
const FORKLIFT_TURN = 1.3; // radians between successive headings, decorative variety

const forkliftLayouts = () => {
  const rand = seeded(11);
  return STATE.forklifts.map((e, k) => [
    e.id,
    {
      x: -HALF_L + 60 + rand() * (S1.length - 120),
      y: PROXY.forklift[1] / 2 + 1,
      z: (rand() - 0.5) * (S1.depth - 120),
      rotY: k * FORKLIFT_TURN,
      size: forkliftSize,
    },
  ]);
};

const buildLayouts = () => {
  const base = new Map([
    ...STATE.doors.map((e) => [e.id, doorLayout(e)]),
    ...STATE.ramps.map((e) => [e.id, rampLayout(e)]),
    ...STATE.stalls.map((e) => [e.id, stallLayout(e)]),
    ...STATE.trailers.map((e) => [e.id, trailerLayout(e)]),
    ...forkliftLayouts(),
  ]);
  return new Map([
    ...base,
    ...STATE.tractors.map((e) => [e.id, tractorLayout(e, base)]),
  ]);
};

export const LAYOUT = buildLayouts();
export const STALL_PITCH = stallSlot(0).pitch;
