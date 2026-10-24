// Mockup run state shared by the 3D scene, the panels and the entity table.
// S1 values are published facts. Everything else is illustrative placeholder
// data for logical time 14:07:30; it is not facility data or a run result.

export const S1 = {
  length: 1642,
  depth: 600,
  clearHeight: 40,
  dockDoors: 182,
  rampDoors: 4,
  trailerSpaces: 235,
  courtDepth: 135,
  trailerParkDepth: 50,
};
export const PROXY = {
  trailer: [53, 13.5, 8.5],
  tractor: [20, 11, 8.5],
  forklift: [8, 7, 4],
  door: [9, 10],
}; // appearance-only proxies, never used for capacity or timing
export const DOORS_PER_SIDE = S1.dockDoors / 2; // schematic split, not surveyed
export const STALLS_NORTH = Math.ceil(S1.trailerSpaces / 2);

export const LOGICAL_TIME = "14:07:30";
export const CLOSED_DOOR = "D-108"; // H-1, hypothetical
export const TARGET_DOOR = "D-112"; // reserved by C-88
export const MOVING_TRAILER = "T-2291";
export const GATE_QUEUE = 4;
export const FORKLIFTS = 24; // scenario placeholder, DFW fleet unknown
export const YARD_TRACTORS = 6; // scenario placeholder, DFW fleet unknown
export const FAILED_FORKLIFT = "F-07"; // H-2, hypothetical

// Outbound trailers held at a door until a shipment's freight arrives.
export const DEPENDENCIES = [
  {
    door: "D-027",
    trailer: "T-2027",
    shipment: "SH-5512",
    heldBy: "T-2291",
    reason: "13 pallets still on board",
  },
  {
    door: "D-074",
    trailer: "T-2074",
    shipment: "SH-5530",
    heldBy: null,
    reason: "picking in staging lane S-06",
  },
  {
    door: "D-153",
    trailer: "T-2153",
    shipment: "SH-5547",
    heldBy: "T-3061",
    reason: "inbound, in P-061 waiting for a door",
  },
];
const WAITING_STALLS = new Set(["P-061"]);

const pad = (n, w) => String(n).padStart(w, "0");
export const doorId = (i) => `D-${pad(i + 1, 3)}`;
export const stallId = (k) => `P-${pad(k + 1, 3)}`;
export const rampId = (k) => `R-${pad(k + 1, 2)}`;
export const forkliftId = (k) => `F-${pad(k + 1, 2)}`;

// Deterministic placeholder generator (mulberry32).
export const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const BLOCKED = new Map(DEPENDENCIES.map((d) => [d.door, d]));
const SERVING_SHARE = 0.33;
const STALL_OCCUPIED_SHARE = 0.55;
const STALL_WAITING_SHARE = 0.07;

const buildDoors = (rand) =>
  Array.from({ length: S1.dockDoors }, (_, i) => {
    const id = doorId(i);
    const side = i < DOORS_PER_SIDE ? "north" : "south";
    const base = { id, kind: "door", index: i, side };
    if (id === CLOSED_DOOR) return { ...base, status: "closed" };
    if (id === TARGET_DOOR) return { ...base, status: "reserved" };
    if (BLOCKED.has(id))
      return { ...base, status: "blocked", trailer: BLOCKED.get(id).trailer };
    return rand() < SERVING_SHARE
      ? { ...base, status: "serving", trailer: `T-${2000 + i + 1}` }
      : { ...base, status: "free" };
  });

const buildStalls = (rand) =>
  Array.from({ length: S1.trailerSpaces }, (_, k) => {
    const id = stallId(k);
    const side = k < STALLS_NORTH ? "north" : "south";
    const base = { id, kind: "stall", index: k, side };
    const forcedWait = WAITING_STALLS.has(id);
    if (!forcedWait && rand() >= STALL_OCCUPIED_SHARE)
      return { ...base, status: "free" };
    const waiting = forcedWait || rand() < STALL_WAITING_SHARE;
    return {
      ...base,
      status: "occupied",
      trailer: `T-${3000 + k + 1}`,
      trailerStatus: waiting ? "waiting" : "parked",
    };
  });

const buildTrailers = (doors, stalls) => [
  ...doors
    .filter((d) => d.trailer)
    .map((d) => ({
      id: d.trailer,
      kind: "trailer",
      status: d.status,
      at: d.id,
    })),
  ...stalls
    .filter((s) => s.trailer)
    .map((s) => ({
      id: s.trailer,
      kind: "trailer",
      status: s.trailerStatus,
      at: s.id,
    })),
  {
    id: MOVING_TRAILER,
    kind: "trailer",
    status: "moving",
    at: `${CLOSED_DOOR} → ${TARGET_DOOR}`,
  },
  ...Array.from({ length: GATE_QUEUE }, (_, k) => ({
    id: `T-${4101 + k}`,
    kind: "trailer",
    status: "gate",
    at: "gate queue",
    queueIndex: k,
  })),
];

const buildTractors = () => [
  ...DEPENDENCIES.map((d, k) => ({
    id: `TR-${301 + k}`,
    kind: "tractor",
    role: "road",
    status: "coupled",
    at: d.trailer,
  })),
  ...Array.from({ length: GATE_QUEUE }, (_, k) => ({
    id: `TR-${411 + k}`,
    kind: "tractor",
    role: "road",
    status: "coupled",
    at: `T-${4101 + k}`,
  })),
  ...Array.from({ length: YARD_TRACTORS }, (_, k) => {
    const id = `YT-${k + 1}`;
    return id === "YT-2"
      ? {
          id,
          kind: "tractor",
          role: "yard",
          status: "moving",
          at: MOVING_TRAILER,
        }
      : {
          id,
          kind: "tractor",
          role: "yard",
          status: "idle",
          at: "yard tractor parking",
          parkIndex: k,
        };
  }),
];

const buildRamps = () =>
  Array.from({ length: S1.rampDoors }, (_, k) => ({
    id: rampId(k),
    kind: "ramp",
    index: k,
    status: "free",
  }));

const buildForklifts = () =>
  Array.from({ length: FORKLIFTS }, (_, k) => {
    const id = forkliftId(k);
    return {
      id,
      kind: "forklift",
      index: k,
      status: id === FAILED_FORKLIFT ? "failed" : "working",
    };
  });

const buildState = () => {
  const rand = seeded(47);
  const doors = buildDoors(rand);
  const stalls = buildStalls(rand);
  return {
    doors,
    stalls,
    ramps: buildRamps(),
    trailers: buildTrailers(doors, stalls),
    tractors: buildTractors(),
    forklifts: buildForklifts(),
  };
};

export const STATE = Object.freeze(buildState());
export const ENTITIES = new Map(
  Object.values(STATE)
    .flat()
    .map((e) => [e.id, e]),
);

const count = (list, pred) => list.filter(pred).length;
export const COUNTS = Object.freeze({
  doorsOccupied: count(STATE.doors, (d) => d.trailer),
  doorsServing: count(STATE.doors, (d) => d.status === "serving"),
  doorsBlocked: count(STATE.doors, (d) => d.status === "blocked"),
  doorsFree: count(STATE.doors, (d) => d.status === "free"),
  stallsOccupied: count(STATE.stalls, (s) => s.trailer),
  stallsFree: count(STATE.stalls, (s) => !s.trailer),
  yardWaiting: count(STATE.trailers, (t) => t.status === "waiting"),
  gateQueue: count(STATE.trailers, (t) => t.status === "gate"),
  outboundBlocked: DEPENDENCIES.length,
  trailersOnSite: count(STATE.trailers, (t) => t.status !== "gate"),
});

const STATUS_TEXT = {
  door: {
    serving: (e) => `serving · ${e.trailer} at door`,
    blocked: (e) => `occupied · ${e.trailer} waiting for outbound freight`,
    closed: () => "closed 14:00–16:00 · hypothetical H-1",
    reserved: () => "free now · reserved by C-88 14:20–15:05",
    free: () => "free",
  },
  stall: {
    occupied: (e) =>
      `occupied · ${e.trailer} (${e.trailerStatus === "waiting" ? "waiting for door" : "parked"})`,
    free: () => "free",
  },
  trailer: {
    serving: (e) => `at ${e.at} · being served`,
    blocked: (e) => `at ${e.at} · waiting for outbound freight`,
    waiting: (e) => `in ${e.at} · waiting for a door`,
    parked: (e) => `in ${e.at} · parked`,
    moving: () => "moving D-108 → D-112 behind YT-2 · C-88",
    gate: () => "outside the gate · waiting for check-in",
  },
  tractor: {
    coupled: (e) => `${e.role} tractor · coupled to ${e.at}`,
    moving: (e) => `yard tractor · moving ${e.at} · A-902`,
    idle: () => "yard tractor · idle",
  },
  ramp: { free: () => "free · no workload assigned" },
  forklift: {
    working: () => "assigned (scenario resource)",
    failed: () => "failed 13:52 · hypothetical H-2",
  },
};
// "observed" view: no DFW observation exists, so occupancy is unknown, never free or full.
const OCCUPANCY_UNKNOWN = "occupancy unknown · no DFW observation";
const OBSERVED_TEXT = {
  door: OCCUPANCY_UNKNOWN,
  ramp: OCCUPANCY_UNKNOWN,
  stall: OCCUPANCY_UNKNOWN,
  trailer: "run state only · not a DFW observation",
  tractor: "scenario placeholder · DFW fleet unknown",
  forklift: "scenario placeholder · DFW fleet unknown",
};
export const statusText = (entity, view) =>
  view === "observed"
    ? OBSERVED_TEXT[entity.kind]
    : STATUS_TEXT[entity.kind][entity.status](entity);

export const KIND_LABEL = {
  door: "dock-high door 9×10 ft (S1)",
  ramp: "ramp door 12×14 ft (S1)",
  stall: "trailer space (S1 count)",
  trailer: "53 ft trailer (proxy)",
  tractor: "tractor (appearance proxy)",
  forklift: "forklift (scenario resource)",
};
