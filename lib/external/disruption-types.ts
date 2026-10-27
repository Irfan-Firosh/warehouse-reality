/**
 * External disruption contracts shared by the Tavily search route and the dashboard.
 * Kept free of the Tavily SDK so client components can parse responses.
 */

import { z } from "zod";

export const externalDisruptionTypeSchema = z.enum([
  "dock_closure",
  "equipment_failure",
  "external_delay",
]);

export type ExternalDisruptionType = z.infer<
  typeof externalDisruptionTypeSchema
>;

/** "tavily": a real search result. "fixture": synthetic offline example. */
export const externalSourceSchema = z.enum(["tavily", "fixture"]);
export type ExternalSource = z.infer<typeof externalSourceSchema>;

export const liveExternalDisruptionSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  url: z.string().nullable(),
  publishedDate: z.string().nullable(),
  category: z.enum(["weather", "highway"]),
  suggestedAction: z.object({
    disruptionType: externalDisruptionTypeSchema,
    targetEntityId: z.string(),
    impactHypothesis: z.string(),
    suggestedDirective: z.string(),
  }),
});

export type LiveExternalDisruption = z.infer<
  typeof liveExternalDisruptionSchema
>;

export const externalSearchResultSchema = z.object({
  source: externalSourceSchema,
  /** Why fixtures were returned instead of search results; null for live results. */
  fallbackReason: z.string().nullable(),
  disruptions: z.array(liveExternalDisruptionSchema),
});

export type ExternalSearchResult = z.infer<typeof externalSearchResultSchema>;

/** What the dashboard passes to the engine when injecting an external disruption. */
export interface ExternalDisruptionConfig {
  title: string;
  type: ExternalDisruptionType;
  targetId: string;
  directive: string;
  source: ExternalSource;
  url: string | null;
}

export const DEFAULT_QUERY =
  "Dallas Fort Worth freight I-35 I-20 I-30 highway closure severe weather";
