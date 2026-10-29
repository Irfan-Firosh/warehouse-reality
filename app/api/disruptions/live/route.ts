/**
 * POST /api/disruptions/live: Tavily disruption scout (PRD §11).
 * Body `{ q?: string }` (max 300 chars; empty body allowed). Returns
 * `{ source, results, reason? }`: `source` says whether the results are live
 * Tavily results ("external_search") or offline fixtures ("illustrative").
 * Over the global or per-client rate limit it returns 429 RATE_LIMITED.
 * The API key stays on the server; the browser never calls Tavily.
 */

import { ScoutRequestBody } from "@/lib/external/disruption-types";
import { clientIdOf, scoutRateLimiter } from "@/lib/external/rate-limit";
import { searchFreightDisruptions } from "@/lib/external/tavily-client";

const RETRY_AFTER_SECONDS = "20";

const invalid = (details: unknown): Response =>
  Response.json({ error: "INVALID_BODY", details }, { status: 400 });

export const POST = async (request: Request): Promise<Response> => {
  const text = await request.text();
  let json: unknown = {};
  if (text.trim() !== "") {
    try {
      json = JSON.parse(text);
    } catch {
      return invalid("malformed JSON");
    }
  }
  const parsed = ScoutRequestBody.safeParse(json);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (!scoutRateLimiter.tryTake(clientIdOf(request))) {
    return Response.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "retry-after": RETRY_AFTER_SECONDS } },
    );
  }
  return Response.json(await searchFreightDisruptions(parsed.data.q));
};
