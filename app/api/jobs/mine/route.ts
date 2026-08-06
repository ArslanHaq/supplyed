import { listMyJobs } from "@/features/jobs/queries";
import type { JobListFilters } from "@/features/jobs/types";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");
    const status = searchParams.get("status");
    const urgent = searchParams.get("urgent");

    const filters: JobListFilters = {
      keyStage: searchParams.get("keyStage") ?? undefined,
      mode: mode === "brief" || mode === "instant" ? mode : undefined,
      search: searchParams.get("search") ?? undefined,
      status: status === "ACTIVE" || status === "CLOSED" || status === "DRAFT" || status === "EXPIRED" ? status : undefined,
      subject: searchParams.get("subject") ?? undefined,
      urgent: urgent === null ? undefined : urgent === "true",
    };

    return Response.json(await listMyJobs(filters));
  } catch (error) {
    return routeError(error);
  }
}
