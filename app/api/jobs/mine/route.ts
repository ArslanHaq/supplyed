import { assertValidQuery } from "@/lib/server/query-validation";
import { listMyJobs } from "@/features/jobs/queries";
import { readJobFilters } from "@/features/jobs/schemas";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    assertValidQuery(new URL(request.url).searchParams, { search: { maxLength: 100 }, subject: { maxLength: 100 }, keyStage: { maxLength: 100 }, status: { values: ["DRAFT", "ACTIVE", "EXPIRED", "CLOSED"] }, urgent: { values: ["true", "false"] } });
    return Response.json(await listMyJobs(readJobFilters(new URL(request.url).searchParams)));
  } catch (error) {
    return routeError(error);
  }
}
