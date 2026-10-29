/**
 * Contracts for the Tavily disruption scout (PRD §11), shared by the search
 * route and the dashboard. Free of the Tavily SDK so client code can parse
 * responses. A search result is context, not evidence the facility was hit;
 * it only seeds a hypothetical external_delay.
 */

import { z } from "zod";

/** "external_search": a real Tavily result. "illustrative": an offline fixture. */
export const ScoutLabel = z.enum(["external_search", "illustrative"]);
export type ScoutLabel = z.infer<typeof ScoutLabel>;

/** Why illustrative fixtures were returned instead of live results. */
export const ScoutFallbackReason = z.enum([
  "no_api_key",
  "search_failed",
  "no_matching_results",
]);
export type ScoutFallbackReason = z.infer<typeof ScoutFallbackReason>;

const resultFields = {
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string(),
  publishedDate: z.string().nullable(),
  category: z.enum(["weather", "highway"]),
  /** Narrative only: never carries a duration or other operational number. */
  impactHypothesis: z.string().min(1),
};

/** Only http(s) links: the timeline renders source URLs as clickable anchors. */
const SourceUrl = z.url({ protocol: /^https?$/ });

export const ScoutResult = z.discriminatedUnion("label", [
  z.object({
    ...resultFields,
    label: z.literal("external_search"),
    url: SourceUrl,
  }),
  z.object({
    ...resultFields,
    label: z.literal("illustrative"),
    url: z.null(),
  }),
]);
export type ScoutResult = z.infer<typeof ScoutResult>;

export const ScoutResponse = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("external_search"),
    results: z.array(ScoutResult),
  }),
  z.object({
    source: z.literal("illustrative"),
    results: z.array(ScoutResult),
    reason: ScoutFallbackReason,
  }),
]);
export type ScoutResponse = z.infer<typeof ScoutResponse>;

export const ScoutRequestBody = z.object({
  q: z.string().trim().max(300).optional(),
});
export type ScoutRequestBody = z.infer<typeof ScoutRequestBody>;

export const DEFAULT_QUERY =
  "Dallas Fort Worth freight I-35 I-20 I-30 highway closure severe weather";
