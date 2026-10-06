import { listMyJobs } from "@/features/jobs/queries";
import { readJobFilters } from "@/features/jobs/schemas";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return Response.json(await listMyJobs(readJobFilters(new URL(request.url).searchParams)));
  } catch (error) {
    return routeError(error);
  }
}
