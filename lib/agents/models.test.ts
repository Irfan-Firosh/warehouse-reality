import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { modelFor, tierForRole } from "./models";

describe("Nemotron model tiers", () => {
  beforeEach(() => {
    vi.stubEnv("NEBIUS_MODEL_NANO", "");
    vi.stubEnv("NEBIUS_MODEL_SUPER", "");
    vi.stubEnv("NEBIUS_MODEL_ULTRA", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("tierForRole maps driver to nano and supervisor to ultra", () => {
    expect(tierForRole("driver")).toBe("nano");
    expect(tierForRole("dock_lead")).toBe("super");
    expect(tierForRole("yard_controller")).toBe("super");
    expect(tierForRole("supervisor")).toBe("ultra");
  });

  it("uses the planned Nemotron ids when no override is set", () => {
    vi.stubEnv("NEBIUS_MODEL_ULTRA", "  ");

    expect(modelFor("nano")).toBe("nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B");
    expect(modelFor("super")).toBe("nvidia/nemotron-3-super-120b-a12b");
    expect(modelFor("ultra")).toBe("nvidia/Nemotron-3-Ultra-550b-a55b");
  });

  it("NEBIUS_MODEL_ULTRA overrides the ultra id", () => {
    vi.stubEnv("NEBIUS_MODEL_ULTRA", " nvidia/nemotron-3-super-120b-a12b ");

    expect(modelFor("ultra")).toBe("nvidia/nemotron-3-super-120b-a12b");
    expect(modelFor("nano")).toBe("nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B");
  });
});
