import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SimulationEngine } from "../engine/engine";
import { AgentRunner } from "./agent-runner";
import { callNebiusModel } from "./nebius-client";

const deliberate = () =>
  callNebiusModel(
    [{ role: "user", content: "Return a JSON thought without a tool call." }],
    "supervisor",
    "SUP-1",
    { time: 50850 },
    [],
    1,
  );

describe("Nebius inference provenance and failure boundaries", () => {
  beforeEach(() => {
    vi.stubEnv("NEBIUS_API_KEY", "");
    vi.stubEnv("NEBIUS_BASE_URL", "");
    vi.stubEnv("NEBIUS_MODEL", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not send an unrelated NVIDIA key to Nebius or call the network offline", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "unrelated-provider-test-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await deliberate();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.isMock).toBe(true);
    expect(result.modelUsed).toBe("deterministic-local-engine");
  });

  it("requests NVIDIA Nemotron through Nebius and preserves provenance through the runner", async () => {
    vi.stubEnv("NEBIUS_API_KEY", "nebius-test-key");
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        choices: [{ message: { content: '{"thought":"Reviewed state."}' } }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new AgentRunner().deliberate(
      "SUP-1",
      new SimulationEngine(),
    );

    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://api.tokenfactory.us-central1.nebius.com/v1/chat/completions",
    );
    expect(JSON.parse(request.body).model).toBe(
      "nvidia/nemotron-3-super-120b-a12b",
    );
    expect(request.headers.Authorization).toBe("Bearer nebius-test-key");
    expect(request.signal).toBeInstanceOf(AbortSignal);
    expect(result.isMock).toBe(false);
    expect(result.modelUsed).toBe("nvidia/nemotron-3-super-120b-a12b");
    expect(result.thought).toBe("Reviewed state.");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("supports configured models and a base URL with a trailing slash", async () => {
    vi.stubEnv("NEBIUS_API_KEY", "nebius-test-key");
    vi.stubEnv("NEBIUS_BASE_URL", "https://example.test/v1/");
    vi.stubEnv("NEBIUS_MODEL", "nvidia/test-model");
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        choices: [{ message: { content: '{"thought":"OK"}' } }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await deliberate();

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://example.test/v1/chat/completions",
    );
    expect(result.modelUsed).toBe("nvidia/test-model");
  });

  it("does not label HTTP errors as live inference", async () => {
    vi.stubEnv("NEBIUS_API_KEY", "nebius-test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Rate limited", { status: 429 })),
    );

    const result = await deliberate();

    expect(result.isMock).toBe(true);
    expect(result.modelUsed).toBe("fallback (429)");
  });

  it.each([
    "malformed output",
    "timeout",
  ])("keeps fallback provenance for %s", async (failure) => {
    vi.stubEnv("NEBIUS_API_KEY", "nebius-test-key");
    const fetchMock = vi.fn();
    if (failure === "timeout") {
      fetchMock.mockRejectedValue(
        new DOMException("Timed out", "TimeoutError"),
      );
    } else {
      fetchMock.mockResolvedValue(
        Response.json({ choices: [{ message: { content: "invalid JSON" } }] }),
      );
    }
    vi.stubGlobal("fetch", fetchMock);

    const result = await deliberate();

    expect(result.isMock).toBe(true);
    expect(result.modelUsed).toBe("fallback-on-error");
  });
});
