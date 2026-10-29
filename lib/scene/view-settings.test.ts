import { describe, expect, it } from "vitest";
import { createAmbientMotion } from "./ambient-motion";
import {
  CLOSED_DOOR,
  ILLUSTRATIVE_STATE,
  MOVING_TRAILER,
  TARGET_DOOR,
} from "./illustrative-state";
import { buildLayout } from "./layout";
import {
  cycleId,
  DEFAULT_VIEW,
  followAfterSelect,
  followableIds,
} from "./view-settings";

describe("cycleId", () => {
  const ids = ["T-1", "T-2", "YT-1"];

  it("steps forward and back, wrapping at both ends", () => {
    expect(cycleId(ids, "T-1", 1)).toBe("T-2");
    expect(cycleId(ids, "YT-1", 1)).toBe("T-1");
    expect(cycleId(ids, "T-1", -1)).toBe("YT-1");
  });

  it("starts at the first or last id when the current one is not in the list", () => {
    expect(cycleId(ids, null, 1)).toBe("T-1");
    expect(cycleId(ids, "D-108", -1)).toBe("YT-1");
  });

  it("returns null when there is nothing to cycle", () => {
    expect(cycleId([], "T-1", 1)).toBeNull();
  });
});

describe("followableIds", () => {
  const layout = buildLayout(ILLUSTRATIVE_STATE, [CLOSED_DOOR, TARGET_DOOR]);
  const motion = createAmbientMotion(ILLUSTRATIVE_STATE, layout);
  const ids = followableIds(ILLUSTRATIVE_STATE, motion);

  it("lists only moving trucks, sorted", () => {
    expect(ids).toContain(MOVING_TRAILER);
    expect(ids).toContain("YT-2");
    expect(ids.every((id) => motion.ids.has(id))).toBe(true);
    expect(ids.some((id) => id.startsWith("F-"))).toBe(false);
    expect([...ids].sort()).toEqual(ids);
  });
});

describe("DEFAULT_VIEW", () => {
  it("starts with illustrative ambient motion on and the full lens", () => {
    expect(DEFAULT_VIEW).toMatchObject({
      ambient: true,
      lens: true,
      lensStrength: 1,
      topDown: false,
    });
  });
});

describe("followAfterSelect", () => {
  it("keeps the chase while the followed truck stays selected", () => {
    expect(followAfterSelect("T-1", "T-1", true)).toBe("T-1");
  });

  it("switches the chase to another selected truck", () => {
    expect(followAfterSelect("T-1", "T-2", true)).toBe("T-2");
  });

  it("stops on a non-truck selection or a cleared one", () => {
    expect(followAfterSelect("T-1", "D-108", false)).toBeNull();
    expect(followAfterSelect("T-1", null, false)).toBeNull();
  });

  it("never starts a chase on its own", () => {
    expect(followAfterSelect(null, "T-2", true)).toBeNull();
  });
});
