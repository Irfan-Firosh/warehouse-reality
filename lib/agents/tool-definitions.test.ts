import { describe, expect, it } from "vitest";
import { AGENT_CHAT_TOOLS, parseToolCall } from "./tool-definitions";

const toolNamed = (name: string) =>
  AGENT_CHAT_TOOLS.find((t) => t.function.name === name);

describe("agent chat tools", () => {
  it("offers JSON Schema parameters generated from the Zod tool schemas", () => {
    const accept = toolNamed("accept");
    expect(accept?.type).toBe("function");
    expect(accept?.function.parameters).toMatchObject({
      type: "object",
      required: ["participantId", "commitmentId", "acceptedAtVersion"],
    });
    expect(accept?.function.parameters).not.toHaveProperty("$schema");
  });

  it("never offers injectDisruption or observe to agents", () => {
    expect(toolNamed("injectDisruption")).toBeUndefined();
    expect(toolNamed("observe")).toBeUndefined();
    expect(parseToolCall("observe", "{}").kind).toBe("invalid");
  });

  it("parses a wait call and rejects one without a reason", () => {
    expect(parseToolCall("wait", '{"reason":"Nothing pending."}')).toEqual({
      kind: "wait",
      reason: "Nothing pending.",
    });
    expect(parseToolCall("wait", '{"reason":"  "}').kind).toBe("invalid");
  });
});
