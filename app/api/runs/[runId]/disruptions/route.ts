import { DisruptionBody } from "@/lib/run/api-schemas";
import { busyOrThrow, errorResponse, findRun, parseBody } from "@/lib/run/http";

export const POST = async (
  request: Request,
  ctx: { params: Promise<{ runId: string }> },
): Promise<Response> => {
  const run = findRun((await ctx.params).runId);
  if (run instanceof Response) return run;
  const parsed = await parseBody(request, DisruptionBody);
  if ("response" in parsed) return parsed.response;
  if (run.busy) return errorResponse("RUN_BUSY", 409);
  try {
    return Response.json(run.injectDisruption(parsed.data));
  } catch (error) {
    return busyOrThrow(error);
  }
};
