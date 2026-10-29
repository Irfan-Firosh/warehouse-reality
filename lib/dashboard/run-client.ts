/**
 * Pure fetch layer for useRun: one request, Zod-validated, mapped to a hook
 * status by nextStatus. Takes fetch as a parameter so it is testable headless.
 */

import type { z } from "zod";
import type { CreateRunBody, DisruptionBody } from "@/lib/run/api-schemas";
import type { RunSnapshot, StepResult } from "@/types/run";
import { nextStatus, type RunStatus } from "./project-run";
import { RunSnapshotSchema, StepResultSchema } from "./run-snapshot-schema";

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export interface RunResponse<T> {
  status: RunStatus;
  /** Present only when the response was 2xx and passed validation. */
  data?: T;
  /** Server error code (e.g. RUN_NOT_FOUND, RUN_BUSY) or a client message. */
  error?: string;
}

const errorCode = async (res: Response): Promise<string> => {
  try {
    const body: unknown = await res.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
    ) {
      return body.error;
    }
  } catch {
    // Non-JSON error body: fall through to the HTTP status.
  }
  return `HTTP_${res.status}`;
};

/** Number of failing paths named in an INVALID_SNAPSHOT error. */
const MAX_ISSUE_PATHS = 3;

const issuePaths = (issues: z.ZodError["issues"]): string => {
  const paths = issues.map((i) => i.path.map(String).join(".") || "(root)");
  const shown = paths.slice(0, MAX_ISSUE_PATHS).join(", ");
  const more = paths.length - MAX_ISSUE_PATHS;
  return more > 0 ? `${shown} (+${more} more)` : shown;
};

const request = async <T>(
  fetchFn: FetchFn,
  url: string,
  init: RequestInit,
  schema: z.ZodType<T>,
): Promise<RunResponse<T>> => {
  let res: Response;
  try {
    res = await fetchFn(url, init);
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : "NETWORK_ERROR",
    };
  }
  if (!res.ok) {
    return { status: nextStatus(res.status), error: await errorCode(res) };
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { status: "error", error: "INVALID_JSON" };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    console.error(`Invalid run snapshot from ${url}`, parsed.error.issues);
    return {
      status: "error",
      error: `INVALID_SNAPSHOT: ${issuePaths(parsed.error.issues)}`,
    };
  }
  return { status: nextStatus(res.status), data: parsed.data };
};

const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

const runPath = (runId: string): string =>
  `/api/runs/${encodeURIComponent(runId)}`;

export const createRunRequest = (
  fetchFn: FetchFn,
  mode: CreateRunBody["mode"],
): Promise<RunResponse<RunSnapshot>> =>
  request(
    fetchFn,
    "/api/runs",
    post({ scenarioId: "d108", mode } satisfies CreateRunBody),
    RunSnapshotSchema,
  );

export const getRunRequest = (
  fetchFn: FetchFn,
  runId: string,
): Promise<RunResponse<RunSnapshot>> =>
  request(
    fetchFn,
    runPath(runId),
    { method: "GET", cache: "no-store" },
    RunSnapshotSchema,
  );

export const stepRunRequest = (
  fetchFn: FetchFn,
  runId: string,
): Promise<RunResponse<StepResult>> =>
  request(fetchFn, `${runPath(runId)}/step`, post({}), StepResultSchema);

export const disruptRunRequest = (
  fetchFn: FetchFn,
  runId: string,
  body: DisruptionBody,
): Promise<RunResponse<StepResult>> =>
  request(
    fetchFn,
    `${runPath(runId)}/disruptions`,
    post(body),
    StepResultSchema,
  );

/**
 * Loads a recorded RunSnapshot file (e.g. /runs/d108-nebius.json). No model
 * calls. A missing file is an error, not a missing run.
 */
export const replayRequest = async (
  fetchFn: FetchFn,
  url: string,
): Promise<RunResponse<RunSnapshot>> => {
  const res = await request(fetchFn, url, { method: "GET" }, RunSnapshotSchema);
  return res.status === "missing"
    ? { status: "error", error: "RECORDING_NOT_FOUND" }
    : res;
};
