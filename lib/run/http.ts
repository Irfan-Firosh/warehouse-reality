/** Shared helpers for the thin /api/runs route handlers. */

import type { z } from "zod";
import { getRun } from "./registry";
import type { Run } from "./run";

export const errorResponse = (
  error: string,
  status: number,
  details?: unknown,
): Response =>
  Response.json(details === undefined ? { error } : { error, details }, {
    status,
  });

/** Parse JSON then validate; `emptyOk` treats an empty body as `{}`. */
export const parseBody = async <T extends z.ZodType>(
  request: Request,
  schema: T,
  emptyOk = false,
): Promise<{ data: z.infer<T> } | { response: Response }> => {
  const text = await request.text();
  let json: unknown = {};
  if (text.trim() !== "" || !emptyOk) {
    try {
      json = JSON.parse(text);
    } catch {
      return { response: errorResponse("INVALID_BODY", 400, "malformed JSON") };
    }
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return {
      response: errorResponse("INVALID_BODY", 400, parsed.error.issues),
    };
  }
  return { data: parsed.data };
};

export const findRun = (runId: string): Run | Response =>
  getRun(runId) ?? errorResponse("RUN_NOT_FOUND", 404);

export const busyOrThrow = (error: unknown): Response => {
  if (error instanceof Error && error.message === "RUN_BUSY") {
    return errorResponse("RUN_BUSY", 409);
  }
  throw error;
};
