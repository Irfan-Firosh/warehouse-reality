/**
 * Tavily disruption scout (PRD §11), server-only: reads TAVILY_API_KEY.
 * Searches recent news for corridor and weather incidents near the reference
 * facility. Live results are labeled external_search and keep their URLs.
 * Without a key, on failure, or when nothing maps to the scenario, it returns
 * illustrative fixtures with the reason. Tavily-backed responses are cached
 * per normalized query so repeated searches spend no extra credits.
 */

import "server-only";
import { tavily } from "@tavily/core";
import { z } from "zod";
import {
  DEFAULT_QUERY,
  type ScoutFallbackReason,
  type ScoutResponse,
  ScoutResult,
} from "./disruption-types";
import { createTtlCache } from "./ttl-cache";

type Category = ScoutResult["category"];

const HYPOTHESIS: Record<Category, string> = {
  weather:
    "Hypothesis: yard and dock moves slow while the weather event lasts; how long is unknown.",
  highway:
    "Hypothesis: inbound freight on this corridor arrives late; the delay length is unknown.",
};

const FIXTURES: ScoutResult[] = [
  {
    id: "ILL-EXT-1",
    label: "illustrative",
    title: "[Illustrative] Severe thunderstorm warning over the DFW metro",
    summary:
      "Illustrative offline example, not a real advisory. A storm warning covers the area around the reference facility.",
    url: null,
    publishedDate: null,
    category: "weather",
    impactHypothesis: HYPOTHESIS.weather,
  },
  {
    id: "ILL-EXT-2",
    label: "illustrative",
    title: "[Illustrative] Lane closures on I-35 approaching Dallas",
    summary:
      "Illustrative offline example, not a real advisory. Lane closures slow inbound freight on the corridor.",
    url: null,
    publishedDate: null,
    category: "highway",
    impactHypothesis: HYPOTHESIS.highway,
  },
];

/** Crashes count only through a road word: "market crash" is not a corridor event. */
const HIGHWAY_PATTERN = new RegExp(
  [
    "highway",
    "interstate",
    "i-\\d+",
    "(?:loop|spur) \\d+",
    "(?:us|sh)-\\d+",
    "freeway",
    "turnpike",
    "tollway",
    "(?:lane|road|ramp) closures?",
    "(?:lanes?|roads?) (?:closed|blocked)",
    "closes (?:\\w+ )?lanes?",
    "traffic (?:jams?|delays?|backups?)",
  ]
    .map((p) => `\\b${p}`)
    .join("|"),
  "i",
);
const WEATHER_PATTERN =
  /\b(?:weather|(?:thunder)?storms?|tornado(?:es)?|hail|blizzards?|snow(?:fall|storm)?|flood(?:s|ing)?|ice storms?|icy|freezing rain|freeze|(?:high|damaging) winds?)\b/i;
const SUMMARY_LIMIT = 220;
const MAX_RESULTS = 6;
const TIMEOUT_SECONDS = 15;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 100;

const TavilyHit = z.object({
  title: z.string(),
  url: z.string(),
  content: z.string(),
  publishedDate: z.string().nullish(),
});
type TavilyHit = z.infer<typeof TavilyHit>;

const TavilyResponse = z.object({ results: z.array(z.unknown()) });

/** Highway wins over weather: a road closure is the more specific impact. */
const categorizeText = (text: string): Category | null => {
  if (HIGHWAY_PATTERN.test(text)) return "highway";
  if (WEATHER_PATTERN.test(text)) return "weather";
  return null;
};

const categorize = (hit: TavilyHit): Category | null =>
  categorizeText(hit.title) ?? categorizeText(hit.content);

const truncate = (text: string): string =>
  text.length > SUMMARY_LIMIT ? `${text.slice(0, SUMMARY_LIMIT - 3)}...` : text;

/** Results matching neither pattern have no defensible mapping to the scenario. */
const mapHit = (hit: TavilyHit, index: number): ScoutResult | null => {
  const category = categorize(hit);
  if (!category) return null;
  const parsed = ScoutResult.safeParse({
    id: `EXT-${index + 1}`,
    label: "external_search",
    title: hit.title.trim() || hit.url,
    summary: truncate(hit.content),
    url: hit.url,
    publishedDate: hit.publishedDate || null,
    category,
    impactHypothesis: HYPOTHESIS[category],
  });
  return parsed.success ? parsed.data : null;
};

/** Parsed one by one: a malformed hit is dropped, not fatal. */
const toResult = (raw: unknown, index: number): ScoutResult | null => {
  const hit = TavilyHit.safeParse(raw);
  return hit.success ? mapHit(hit.data, index) : null;
};

const illustrative = (reason: ScoutFallbackReason): ScoutResponse => ({
  source: "illustrative",
  results: FIXTURES,
  reason,
});

const describeError = (err: unknown, apiKey: string): string => {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : "";
  return message.replaceAll(apiKey, "[redacted]") || "unknown error";
};

const searchTavily = async (
  query: string,
  apiKey: string,
): Promise<ScoutResponse> => {
  try {
    const response = await tavily({ apiKey }).search(query, {
      topic: "news",
      timeRange: "week",
      maxResults: MAX_RESULTS,
      searchDepth: "basic",
      includeAnswer: false,
      timeout: TIMEOUT_SECONDS,
    });
    const results = TavilyResponse.parse(response)
      .results.map(toResult)
      .filter((r): r is ScoutResult => r !== null);
    if (results.length === 0) return illustrative("no_matching_results");
    return { source: "external_search", results };
  } catch (err) {
    console.warn(
      "Tavily search failed; returning illustrative fixtures:",
      describeError(err, apiKey),
    );
    return illustrative("search_failed");
  }
};

const normalize = (q: string): string =>
  q.trim().replace(/\s+/g, " ").toLowerCase();

/** Failed searches are not cached, so the next request retries. */
const cache = createTtlCache<ScoutResponse>({
  ttlMs: CACHE_TTL_MS,
  maxEntries: CACHE_MAX_ENTRIES,
});
const keepResponse = (r: ScoutResponse): boolean =>
  r.source === "external_search" || r.reason !== "search_failed";

export const searchFreightDisruptions = async (
  q?: string,
): Promise<ScoutResponse> => {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) return illustrative("no_api_key");
  const query = q?.trim() || DEFAULT_QUERY;
  return cache.get(
    normalize(query),
    () => searchTavily(query, apiKey),
    keepResponse,
  );
};
