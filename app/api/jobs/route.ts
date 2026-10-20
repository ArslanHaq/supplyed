import { assertValidQuery } from "@/lib/server/query-validation";
import { listJobs } from "@/features/jobs/queries";
import { readJobFilters } from "@/features/jobs/schemas";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    assertValidQuery(new URL(request.url).searchParams, { search: { maxLength: 100 }, subject: { maxLength: 100 }, keyStage: { maxLength: 100 }, urgent: { values: ["true", "false"] } });
    return Response.json(await listJobs(readJobFilters(new URL(request.url).searchParams)));
  } catch (error) {
    return routeError(error);
  }
}
