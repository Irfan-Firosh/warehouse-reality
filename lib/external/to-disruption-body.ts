/**
 * Turns a chosen scout result into the body for POST /api/runs/:id/disruptions.
 * Pure and client-safe.
 */

import { DisruptionBody } from "@/lib/run/api-schemas";
import type { ScoutResult } from "./disruption-types";

/** Copy the UI must show beside an injected fixture: the run records it as operator. */
export const ILLUSTRATIVE_INJECTION_NOTE =
  "Illustrative example — recorded as an operator hypothetical";

/**
 * Live results carry their link as a source. Illustrative fixtures send no
 * sources: RunSourceSchema has no illustrative marker, and the run labels any
 * disruption with sources as external_search, so the run records it as an
 * operator hypothetical instead.
 */
export const toDisruptionBody = (
  result: ScoutResult,
  targetId: string,
): DisruptionBody =>
  DisruptionBody.parse({
    type: "external_delay",
    targetId,
    ...(result.label === "external_search"
      ? { sources: [{ title: result.title, url: result.url }] }
      : {}),
  });
