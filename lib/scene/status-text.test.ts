import { describe, expect, it } from "vitest";
import { entitiesById, ILLUSTRATIVE_STATE } from "./illustrative-state";
import { statusText } from "./status-text";

describe("statusText", () => {
  it("adds no time the state does not carry", () => {
    expect(
      statusText({ id: "F-1", kind: "forklift", index: 0, status: "failed" }),
    ).toBe("failed");
    expect(
      statusText({ id: "D-001", kind: "door", index: 0, status: "closed" }),
    ).toBe("closed");
    expect(
      statusText({ id: "D-002", kind: "door", index: 1, status: "reserved" }),
    ).toBe("free now · reserved");
  });

  it("shows the illustrative state's hypothetical windows", () => {
    const byId = entitiesById(ILLUSTRATIVE_STATE);
    const text = (id: string) => {
      const e = byId.get(id);
      if (!e) throw new Error(`no ${id}`);
      return statusText(e);
    };
    expect(text("F-07")).toBe("failed 13:52 · hypothetical");
    expect(text("D-108")).toBe("closed 14:00–16:00 · hypothetical");
    expect(text("D-112")).toBe("free now · reserved 14:20–15:05");
  });

  it("names a closed ramp", () => {
    expect(
      statusText({ id: "R-01", kind: "ramp", index: 0, status: "closed" }),
    ).toBe("closed");
  });
});
