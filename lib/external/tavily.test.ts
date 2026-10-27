import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const search = vi.fn();
vi.mock("@tavily/core", () => ({ tavily: () => ({ search }) }));

const { searchFreightDisruptions } = await import("./tavily-client");

const result = (title: string, content: string) => ({
  title,
  content,
  url: `https://news.example/${encodeURIComponent(title)}`,
  publishedDate: "2026-10-25",
  score: 0.9,
  id: title,
});

describe("searchFreightDisruptions", () => {
  beforeEach(() => {
    search.mockReset();
    vi.stubEnv("TAVILY_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns labeled synthetic fixtures when no key is configured", async () => {
    vi.stubEnv("TAVILY_API_KEY", "");
    const res = await searchFreightDisruptions();
    expect(res.source).toBe("fixture");
    expect(res.fallbackReason).toMatch(/TAVILY_API_KEY/);
    expect(search).not.toHaveBeenCalled();
    for (const d of res.disruptions) {
      expect(d.title).toMatch(/^\[Synthetic\]/);
      expect(d.url).toBeNull();
    }
  });

  it("maps weather and highway news and drops unrelated results", async () => {
    search.mockResolvedValue({
      results: [
        result("Tornado warning for Tarrant County", "Severe storm expected"),
        result("I-35 lane closure in Dallas", "Traffic backed up for miles"),
        result("Port earnings beat estimates", "Quarterly revenue rose"),
      ],
    });

    const res = await searchFreightDisruptions("dfw");
    expect(res.source).toBe("tavily");
    expect(res.fallbackReason).toBeNull();
    expect(res.disruptions.map((d) => d.category)).toEqual([
      "weather",
      "highway",
    ]);
    expect(res.disruptions[0].suggestedAction).toMatchObject({
      disruptionType: "dock_closure",
      targetEntityId: "D-108",
    });
    expect(res.disruptions[1].suggestedAction).toMatchObject({
      disruptionType: "external_delay",
      targetEntityId: "DRV-047",
    });
    expect(res.disruptions[0].url).toContain("https://news.example/");
  });

  it("falls back to fixtures, labeled as such, when the search throws", async () => {
    search.mockRejectedValue(new Error("network down"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await searchFreightDisruptions();
    expect(res.source).toBe("fixture");
    expect(res.fallbackReason).toMatch(/failed/);
  });

  it("falls back to fixtures when nothing maps to the scenario", async () => {
    search.mockResolvedValue({
      results: [result("Port earnings beat estimates", "Revenue rose")],
    });
    const res = await searchFreightDisruptions();
    expect(res.source).toBe("fixture");
  });
});
