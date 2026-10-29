import { describe, expect, it } from "vitest";
import { quantize, TRUCK_PACE } from "./ambient-motion";
import { type CameraPose, chaseAzimuth, chasePose } from "./camera-fit";
import { followStep, isSettled } from "./follow";
import type { Placement } from "./types";

const truckAt = (x: number): Placement => ({
  x,
  y: 6,
  z: 400,
  rotY: Math.PI / 2,
  size: [8.5, 11, 20],
});
const SIDE = chaseAzimuth(truckAt(0));
const START: CameraPose = { position: [-900, 1400, 1800], target: [0, 0, 0] };

/** Drives a truck at TRUCK_PACE × speed for `seconds` at `hz` frames; returns when the settle ended. */
const drive = (speed: 1 | 4 | 16, hz: number, seconds: number) => {
  const dt = 1 / hz;
  let view = START;
  let prevX = 0;
  let settledAt: number | null = null;
  for (let i = 1; i <= seconds * hz; i += 1) {
    const x = quantize(i * dt * speed, speed) * TRUCK_PACE;
    const goal = chasePose(truckAt(x), SIDE);
    view = followStep(
      view,
      { dx: x - prevX, dz: 0 },
      settledAt === null ? goal : null,
      dt,
    );
    prevX = x;
    if (settledAt === null && isSettled(view, goal)) settledAt = i * dt;
  }
  return { view, settledAt, goal: chasePose(truckAt(prevX), SIDE) };
};

describe("followStep", () => {
  it.each([
    [1, 60],
    [4, 60],
    [16, 60],
    [16, 30],
  ] as const)("settles on a truck driving at %i× (%i Hz frames)", (speed, hz) => {
    const { settledAt, view, goal } = drive(speed, hz, 6);
    expect(settledAt).not.toBeNull();
    expect(settledAt).toBeLessThan(3);
    // After the settle the camera rides with the truck exactly.
    expect(isSettled(view, goal)).toBe(true);
  });

  it("eases the same at any frame rate", () => {
    const after = (hz: number) => {
      let view = START;
      for (let i = 0; i < hz; i += 1) {
        view = followStep(
          view,
          { dx: 0, dz: 0 },
          chasePose(truckAt(0), SIDE),
          1 / hz,
        );
      }
      return view.position;
    };
    const slow = after(30);
    const fast = after(144);
    for (let a = 0; a < 3; a += 1) expect(slow[a]).toBeCloseTo(fast[a], 6);
  });

  it("without a goal, only carries the view along the truck's ground move", () => {
    const view = followStep(START, { dx: 12, dz: -5 }, null, 1 / 60);
    expect(view.position).toEqual([-888, 1400, 1795]);
    expect(view.target).toEqual([12, 0, -5]);
  });
});
