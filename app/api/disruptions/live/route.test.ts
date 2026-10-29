import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScoutResponse } from "@/lib/external/disruption-types";

const search = vi.fn();
vi.mock("@tavily/core", () => ({ tavily: () => ({ search }) }));
vi.mock("server-only", () => ({}));

const TEST_KEY = "tvly-route-secret-key";

let POST: typeof import("./route").POST;

const post = (body: string, ip = "203.0.113.1") =>
  new Request("http://test/api/disruptions/live", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body,
  });

describe("POST /api/disruptions/live", () => {
  beforeEach(async () => {
    // Fresh modules reset the query cache and the rate limiter.
    vi.resetModules();
    ({ POST } = await import("./route"));
    search.mockReset();
    vi.stubEnv("TAVILY_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("returns illustrative fixtures with a reason when no key is set", async () => {
    for (const body of ["", "{}", '{"q":"dfw storms"}']) {
      const res = await POST(post(body));
      expect(res.status).toBe(200);
      const json = ScoutResponse.parse(await res.json());
      expect(json.source).toBe("illustrative");
      expect(json).toMatchObject({ reason: "no_api_key" });
    }
  });

  it("rejects malformed JSON, a non-string q, and q over 300 chars with 400", async () => {
    for (const body of [
      "{not json",
      '{"q":42}',
      JSON.stringify({ q: "x".repeat(301) }),
    ]) {
      const res = await POST(post(body));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("INVALID_BODY");
    }
  });

  it("returns live results labeled external_search with their URLs", async () => {
    vi.stubEnv("TAVILY_API_KEY", TEST_KEY);
    search.mockResolvedValue({
      results: [
        {
          title: "I-35 lane closure in Dallas",
          url: "https://news.example/i35",
          content: "Traffic backed up",
          publishedDate: "2026-10-25",
          score: 0.9,
        },
      ],
    });
    const res = await POST(post('{"q":"dfw closures"}'));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(TEST_KEY);
    const json = ScoutResponse.parse(JSON.parse(text));
    expect(json).toEqual({
      source: "external_search",
      results: [
        expect.objectContaining({
          label: "external_search",
          category: "highway",
          title: "I-35 lane closure in Dallas",
          url: "https://news.example/i35",
        }),
      ],
    });
  });

  it("returns fixtures with reason search_failed when Tavily rejects, without the key", async () => {
    vi.stubEnv("TAVILY_API_KEY", TEST_KEY);
    search.mockRejectedValue(new Error(`401 Error: bad key ${TEST_KEY}`));
    const res = await POST(post("{}"));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(TEST_KEY);
    const json = ScoutResponse.parse(JSON.parse(text));
    expect(json).toMatchObject({
      source: "illustrative",
      reason: "search_failed",
    });
    expect(json.results.every((r) => r.label === "illustrative")).toBe(true);
  });

  it("returns 429 RATE_LIMITED once a client spends its burst, until it refills", async () => {
    vi.useFakeTimers();
    for (let i = 0; i < 5; i++) {
      expect((await POST(post("{}"))).status).toBe(200);
    }
    const limited = await POST(post("{}"));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("20");
    expect(await limited.json()).toEqual({ error: "RATE_LIMITED" });
    expect((await POST(post("{}", "198.51.100.7"))).status).toBe(200);
    vi.advanceTimersByTime(20000);
    expect((await POST(post("{}"))).status).toBe(200);
  });

  it("caps all clients together with the global bucket", async () => {
    vi.useFakeTimers();
    const statuses = [];
    for (let i = 0; i < 21; i++) {
      statuses.push((await POST(post("{}", `198.51.100.${i}`))).status);
    }
    expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
    expect(statuses[20]).toBe(429);
  });
});
