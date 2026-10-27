/**
 * Tavily External Disruption Search (PRD §11).
 * Searches recent news for corridor and weather incidents near the reference facility
 * and maps them to hypothetical rehearsal disruptions. A search result is context,
 * not evidence that the facility was affected; the mapping is an application hypothesis.
 */

import { tavily } from "@tavily/core";
import {
  DEFAULT_QUERY,
  type ExternalSearchResult,
  type LiveExternalDisruption,
} from "./disruption-types";

const FIXTURE_DISRUPTIONS: LiveExternalDisruption[] = [
  {
    id: "SYN-EXT-1",
    title: "[Synthetic] Severe thunderstorm warning over the DFW metro",
    summary:
      "Synthetic offline example, not a real advisory. A storm warning covers the area around the reference facility.",
    url: null,
    publishedDate: null,
    category: "weather",
    suggestedAction: {
      disruptionType: "dock_closure",
      targetEntityId: "D-108",
      impactHypothesis:
        "Hypothesis: exposed dock D-108 is closed while the warning is active.",
      suggestedDirective:
        "Weather warning reported near the facility. D-108 is closed as a precaution; reassign the trailer at D-108.",
    },
  },
  {
    id: "SYN-EXT-2",
    title: "[Synthetic] Lane closures on I-35 approaching Dallas",
    summary:
      "Synthetic offline example, not a real advisory. Lane closures slow inbound freight on the corridor.",
    url: null,
    publishedDate: null,
    category: "highway",
    suggestedAction: {
      disruptionType: "external_delay",
      targetEntityId: "DRV-047",
      impactHypothesis:
        "Hypothesis: inbound driver DRV-047 arrives late; delay length is unknown.",
      suggestedDirective:
        "Corridor incident reported on your inbound route. Report a revised ETA and request a new dock window if needed.",
    },
  },
];

const WEATHER_PATTERN =
  /weather|storm|tornado|hail|blizzard|snow|flood|ice|freeze|wind/i;
const HIGHWAY_PATTERN =
  /highway|interstate|\bi-\d+|freeway|turnpike|crash|lane closure|road closure|traffic/i;

const SUMMARY_LIMIT = 220;

const toDisruption = (
  result: {
    title: string;
    url: string;
    content: string;
    publishedDate: string;
  },
  index: number,
): LiveExternalDisruption | null => {
  const text = `${result.title} ${result.content}`;
  const category = WEATHER_PATTERN.test(text)
    ? "weather"
    : HIGHWAY_PATTERN.test(text)
      ? "highway"
      : null;
  // Results that match neither pattern have no defensible mapping to the scenario.
  if (!category) return null;

  const fixture = FIXTURE_DISRUPTIONS.find((d) => d.category === category);
  if (!fixture) return null;

  return {
    id: `EXT-${index + 1}`,
    title: result.title,
    summary:
      result.content.length > SUMMARY_LIMIT
        ? `${result.content.slice(0, SUMMARY_LIMIT - 3)}...`
        : result.content,
    url: result.url,
    publishedDate: result.publishedDate || null,
    category,
    suggestedAction: fixture.suggestedAction,
  };
};

const fixtures = (fallbackReason: string): ExternalSearchResult => ({
  source: "fixture",
  fallbackReason,
  disruptions: FIXTURE_DISRUPTIONS,
});

/**
 * Searches recent news via Tavily. Returns synthetic fixtures, labeled as such,
 * when TAVILY_API_KEY is missing, the search fails, or nothing maps to the scenario.
 */
export const searchFreightDisruptions = async (
  customQuery?: string,
): Promise<ExternalSearchResult> => {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return fixtures("TAVILY_API_KEY is not configured.");

  const query = customQuery?.trim() || DEFAULT_QUERY;

  try {
    const response = await tavily({ apiKey }).search(query, {
      topic: "news",
      timeRange: "week",
      maxResults: 6,
      searchDepth: "basic",
      includeAnswer: false,
    });

    const disruptions = response.results
      .map(toDisruption)
      .filter((d): d is LiveExternalDisruption => d !== null);

    if (disruptions.length === 0) {
      return fixtures("No recent weather or highway results matched.");
    }
    return { source: "tavily", fallbackReason: null, disruptions };
  } catch (err) {
    console.warn("Tavily search failed; returning synthetic fixtures:", err);
    return fixtures("Tavily search failed.");
  }
};
