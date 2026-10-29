import { CreateRunBody } from "@/lib/run/api-schemas";
import { parseBody } from "@/lib/run/http";
import { createRun } from "@/lib/run/registry";

export const POST = async (request: Request): Promise<Response> => {
  const parsed = await parseBody(request, CreateRunBody);
  if ("response" in parsed) return parsed.response;
  return Response.json(createRun(parsed.data).snapshot());
};
