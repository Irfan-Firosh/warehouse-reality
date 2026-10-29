import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DisruptionBody } from "@/lib/run/api-schemas";

const search = vi.fn();
const tavily = vi.fn((_options: { apiKey: string }) => ({ search }));
vi.mock("@tavily/core", () => ({ tavily }));
vi.mock("server-only", () => ({}));

type Client = typeof import("./tavily-client");
let searchFreightDisruptions: Client["searchFreightDisruptions"];
const { toDisruptionBody } = await import("./to-disruption-body");

/** Fresh module per test so the query cache never leaks between tests. */
const loadClient = async () => {
  vi.resetModules();
  ({ searchFreightDisruptions } = await import("./tavily-client"));
};

const TEST_KEY = "tvly-test-secret-key";
const TARGET = "T-2291";

const hit = (title: string, content: string, url?: string) => ({
  title,
  content,
  url: url ?? `https://news.example/${encodeURIComponent(title)}`,
  publishedDate: "2026-10-25",
  score: 0.9,
  id: title,
});

const liveResponse = (results: ReturnType<typeof hit>[]) => ({
  query: "q",
  responseTime: 0.4,
  images: [],
  results,
  requestId: "req-1",
});

describe("searchFreightDisruptions", () => {
  beforeEach(async () => {
    await loadClient();
    search.mockReset();
    tavily.mockClear();
    vi.stubEnv("TAVILY_API_KEY", TEST_KEY);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('fixture results are labeled "illustrative", never "external_search"', async () => {
    vi.stubEnv("TAVILY_API_KEY", "");
    const res = await searchFreightDisruptions();
    expect(res.source).toBe("illustrative");
    expect(res.results.length).toBeGreaterThan(0);
    for (const r of res.results) {
      expect(r.label).toBe("illustrative");
      expect(r.label).not.toBe("external_search");
      expect(r.url).toBeNull();
      expect(r.title).toMatch(/^\[Illustrative\]/);
    }
  });

  it("returns fixtures with reason no_api_key and never calls Tavily when the key is missing", async () => {
    vi.stubEnv("TAVILY_API_KEY", "");
    const res = await searchFreightDisruptions("dfw storms");
    expect(res).toMatchObject({ source: "illustrative", reason: "no_api_key" });
    expect(tavily).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });

  it("returns live results labeled external_search with their URLs and no reason", async () => {
    search.mockResolvedValue(
      liveResponse([
        hit("Tornado warning for Tarrant County", "Severe storm expected"),
        hit("I-35 lane closure in Dallas", "Traffic backed up"),
        hit("Port earnings beat estimates", "Quarterly revenue rose"),
      ]),
    );
    const res = await searchFreightDisruptions("  dfw  ");
    expect(tavily).toHaveBeenCalledWith({ apiKey: TEST_KEY });
    expect(search).toHaveBeenCalledWith("dfw", {
      topic: "news",
      timeRange: "week",
      maxResults: 6,
      searchDepth: "basic",
      includeAnswer: false,
      timeout: 15,
    });
    expect(res.source).toBe("external_search");
    expect("reason" in res).toBe(false);
    expect(res.results.map((r) => r.category)).toEqual(["weather", "highway"]);
    for (const r of res.results) {
      expect(r.label).toBe("external_search");
      expect(r.url).toMatch(/^https:\/\/news\.example\//);
    }
  });

  it("uses the default query when q is blank", async () => {
    search.mockResolvedValue(liveResponse([hit("Storm warning", "Hail")]));
    await searchFreightDisruptions("   ");
    expect(search.mock.calls[0]?.[0]).toMatch(/Dallas Fort Worth/);
  });

  it("drops live results whose URL is not http(s)", async () => {
    search.mockResolvedValue(
      liveResponse([
        hit("Storm warning", "Hail", "javascript:alert(1)"),
        hit("Flood warning", "Rain", "https://news.example/flood"),
      ]),
    );
    const res = await searchFreightDisruptions();
    expect(res.results.map((r) => r.url)).toEqual([
      "https://news.example/flood",
    ]);
  });

  it("falls back to illustrative fixtures with reason search_failed when Tavily throws, without leaking the key", async () => {
    search.mockRejectedValue(new Error(`401 Error: bad key ${TEST_KEY}`));
    const warn = vi.mocked(console.warn);
    const res = await searchFreightDisruptions();
    expect(res.source).toBe("illustrative");
    expect(res).toMatchObject({
      source: "illustrative",
      reason: "search_failed",
    });
    expect(res.results.every((r) => r.label === "illustrative")).toBe(true);
    expect(JSON.stringify(res)).not.toContain(TEST_KEY);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(TEST_KEY);
  });

  it("falls back to illustrative fixtures with reason no_matching_results when nothing maps", async () => {
    search.mockResolvedValue(
      liveResponse([hit("Port earnings beat estimates", "Revenue rose")]),
    );
    const res = await searchFreightDisruptions();
    expect(res.source).toBe("illustrative");
    expect(res).toMatchObject({
      source: "illustrative",
      reason: "no_matching_results",
    });
  });

  it("categorizes on word boundaries, highway before weather", async () => {
    search.mockResolvedValue(
      liveResponse([
        hit("Police chief resigns", "City office closed"),
        hit("Price of service rises", "Window makers report sales"),
        hit("Trafficking ring charged", "Stock market crash wipes out gains"),
        hit(
          "Police say I-35 crash closes two lanes",
          "Storm cleanup continues",
        ),
        hit("Ice storm warning for Tarrant County", "Freezing rain tonight"),
        hit("Crash closes two lanes downtown", "No injuries"),
      ]),
    );
    const res = await searchFreightDisruptions();
    expect(res.results.map((r) => [r.title, r.category])).toEqual([
      ["Police say I-35 crash closes two lanes", "highway"],
      ["Ice storm warning for Tarrant County", "weather"],
      ["Crash closes two lanes downtown", "highway"],
    ]);
  });

  it("drops a malformed hit and keeps the valid one beside it", async () => {
    search.mockResolvedValue(
      liveResponse([
        { ...hit("x", "Storm"), title: null } as unknown as ReturnType<
          typeof hit
        >,
        hit("Flood warning", "Rain", "https://news.example/flood"),
      ]),
    );
    const res = await searchFreightDisruptions();
    expect(res.source).toBe("external_search");
    expect(res.results.map((r) => r.url)).toEqual([
      "https://news.example/flood",
    ]);
  });

  describe("query cache", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("shares one Tavily call between concurrent and repeated equal queries", async () => {
      search.mockResolvedValue(liveResponse([hit("Storm warning", "Hail")]));
      const [a, b] = await Promise.all([
        searchFreightDisruptions("DFW  storms"),
        searchFreightDisruptions(" dfw storms "),
      ]);
      expect(a).toEqual(b);
      await searchFreightDisruptions("dfw storms");
      expect(search).toHaveBeenCalledTimes(1);
      await searchFreightDisruptions("i-35 closure");
      expect(search).toHaveBeenCalledTimes(2);
    });

    it("expires entries after 10 minutes", async () => {
      search.mockResolvedValue(liveResponse([hit("Storm warning", "Hail")]));
      await searchFreightDisruptions();
      vi.advanceTimersByTime(10 * 60 * 1000 - 1);
      await searchFreightDisruptions();
      expect(search).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(1);
      await searchFreightDisruptions();
      expect(search).toHaveBeenCalledTimes(2);
    });

    it("does not cache a failed search", async () => {
      search.mockRejectedValueOnce(new Error("503 Error"));
      search.mockResolvedValue(liveResponse([hit("Storm warning", "Hail")]));
      expect((await searchFreightDisruptions()).source).toBe("illustrative");
      expect((await searchFreightDisruptions()).source).toBe("external_search");
      expect(search).toHaveBeenCalledTimes(2);
    });
  });
});

describe("toDisruptionBody", () => {
  beforeEach(async () => {
    await loadClient();
    search.mockReset();
    vi.stubEnv("TAVILY_API_KEY", TEST_KEY);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("live results carry source URLs into DisruptionBody.sources", async () => {
    search.mockResolvedValue(
      liveResponse([
        hit(
          "I-35 lane closure in Dallas",
          "Traffic backed up",
          "https://news.example/i35",
        ),
      ]),
    );
    const [live] = (await searchFreightDisruptions()).results;
    if (!live) throw new Error("expected a live result");
    const body = toDisruptionBody(live, TARGET);
    expect(body).toEqual({
      type: "external_delay",
      targetId: TARGET,
      sources: [
        {
          title: "I-35 lane closure in Dallas",
          url: "https://news.example/i35",
        },
      ],
    });
    expect(DisruptionBody.safeParse(body).success).toBe(true);
  });

  it("fixture results produce a body with no sources", async () => {
    vi.stubEnv("TAVILY_API_KEY", "");
    const [fixture] = (await searchFreightDisruptions()).results;
    if (!fixture) throw new Error("expected a fixture result");
    const body = toDisruptionBody(fixture, TARGET);
    expect(body).toEqual({ type: "external_delay", targetId: TARGET });
    expect(body.sources).toBeUndefined();
  });

  it("rejects an empty targetId", async () => {
    vi.stubEnv("TAVILY_API_KEY", "");
    const [fixture] = (await searchFreightDisruptions()).results;
    if (!fixture) throw new Error("expected a fixture result");
    expect(() => toDisruptionBody(fixture, "")).toThrow();
  });
});
