import { findRun } from "@/lib/run/http";

export const GET = async (
  _request: Request,
  ctx: { params: Promise<{ runId: string }> },
): Promise<Response> => {
  const run = findRun((await ctx.params).runId);
  return run instanceof Response ? run : Response.json(run.snapshot());
};
