import { describe, expect, it } from "vitest";
import { exceptionOptions } from "./exceptions";
import {
  CLOSED_DOOR,
  ILLUSTRATIVE_STATE,
  MOVING_TRAILER,
  TARGET_DOOR,
} from "./illustrative-state";

describe("exceptionOptions", () => {
  const options = exceptionOptions(ILLUSTRATIVE_STATE);
  const ids = options.map((o) => o.id);

  it("lists every closed, reserved, blocked, failed and moving entity", () => {
    expect(ids).toEqual([
      "D-027",
      "D-074",
      CLOSED_DOOR,
      TARGET_DOOR,
      "D-153",
      "T-2027",
      "T-2074",
      "T-2153",
      MOVING_TRAILER,
      "YT-2",
      "F-07",
    ]);
  });

  it("labels each option with its id and status", () => {
    expect(options).toContainEqual({
      id: CLOSED_DOOR,
      label: "D-108 · closed",
    });
    expect(options).toContainEqual({ id: "F-07", label: "F-07 · failed" });
  });

  it("leaves out normal states", () => {
    const normal = ILLUSTRATIVE_STATE.doors.find((d) => d.status === "free");
    expect(normal).toBeDefined();
    expect(ids).not.toContain(normal?.id);
  });
});
