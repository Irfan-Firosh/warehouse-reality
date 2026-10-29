import { describe, expect, it } from "vitest";
import { CreateRunBody, DisruptionBody, StepBody } from "./api-schemas";

describe("run API schemas", () => {
  it("accepts a live D-108 run", () =>
    expect(
      CreateRunBody.safeParse({ scenarioId: "d108", mode: "live" }).success,
    ).toBe(true));
  it("rejects unknown scenarios", () =>
    expect(
      CreateRunBody.safeParse({ scenarioId: "d999", mode: "live" }).success,
    ).toBe(false));
  it("rejects maxTurns above 8", () =>
    expect(StepBody.safeParse({ maxTurns: 9 }).success).toBe(false));
  it("rejects maxTurns below 1", () =>
    expect(StepBody.safeParse({ maxTurns: 0 }).success).toBe(false));
  it("rejects fractional maxTurns", () =>
    expect(StepBody.safeParse({ maxTurns: 2.5 }).success).toBe(false));
  it("defaults maxTurns to 4", () =>
    expect(StepBody.parse({}).maxTurns).toBe(4));
  it("rejects unknown disruption types", () =>
    expect(
      DisruptionBody.safeParse({ type: "fire", targetId: "D-108" }).success,
    ).toBe(false));
  it("requires source URLs to be URLs", () =>
    expect(
      DisruptionBody.safeParse({
        type: "external_delay",
        targetId: "T-2291",
        sources: [{ title: "x", url: "nope" }],
      }).success,
    ).toBe(false));
  it("accepts an external delay with sources", () =>
    expect(
      DisruptionBody.safeParse({
        type: "external_delay",
        targetId: "T-2291",
        sources: [{ title: "I-35 closure", url: "https://example.com/news" }],
      }).success,
    ).toBe(true));
});
