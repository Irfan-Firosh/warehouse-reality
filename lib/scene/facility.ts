// DFW Commerce Center Building I published specs (source S1, retrieved 2026-10-11).
// Counts are capacity, not occupancy. Positions derived from them are schematic.
export const S1 = {
  length: 1642,
  depth: 600,
  clearHeight: 40,
  dockDoors: 182,
  rampDoors: 4,
  trailerSpaces: 235,
  courtDepth: 135,
  trailerParkDepth: 50,
} as const;

/** Appearance-only proxy sizes in ft as [width, height, length]; never used for capacity or timing. */
export const PROXY = {
  trailer: [8.5, 13.5, 53],
  tractor: [8.5, 11, 20],
  forklift: [4, 7, 8],
  door: [9, 10],
  ramp: [12, 14],
} as const;

export const DOORS_PER_SIDE = S1.dockDoors / 2; // schematic split, not surveyed
export const STALLS_NORTH = Math.ceil(S1.trailerSpaces / 2);
export const STALLS_SOUTH = S1.trailerSpaces - STALLS_NORTH;
export const HALF_L = S1.length / 2;
export const HALF_D = S1.depth / 2;

const pad = (n: number, width: number): string =>
  String(n).padStart(width, "0");
export const doorId = (i: number): string => `D-${pad(i + 1, 3)}`;
export const stallId = (k: number): string => `P-${pad(k + 1, 3)}`;
export const rampId = (k: number): string => `R-${pad(k + 1, 2)}`;
export const forkliftId = (k: number): string => `F-${pad(k + 1, 2)}`;

/** Deterministic placeholder generator (mulberry32) for illustrative layouts. */
export const seeded = (seed: number): (() => number) => {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
