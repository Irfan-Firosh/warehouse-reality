/**
 * API Route: External disruption search via Tavily (PRD §11).
 * The response's `source` says whether results are real search results or synthetic fixtures.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { searchFreightDisruptions } from "@/lib/external/tavily-client";

const requestSchema = z.object({
  q: z.string().max(300).optional(),
});

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await searchFreightDisruptions(parsed.data.q);
  return NextResponse.json(result);
}
