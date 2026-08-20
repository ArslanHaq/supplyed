import { listMyJobs } from "@/features/jobs/queries";
import type { JobListFilters } from "@/features/jobs/types";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const duration = searchParams.get("duration");
    const mode = searchParams.get("mode");
    const status = searchParams.get("status");
    const urgent = searchParams.get("urgent");

    const filters: JobListFilters = {
      duration:
        duration === "single-day" || duration === "multi-day" || duration === "long-term"
          ? duration
          : undefined,
      keyStage: searchParams.get("keyStage") ?? undefined,
      location: searchParams.get("location") ?? undefined,
      maxPay: readNumber(searchParams.get("maxPay")),
      minPay: readNumber(searchParams.get("minPay")),
      mode: mode === "brief" || mode === "instant" ? mode : undefined,
      search: searchParams.get("search") ?? undefined,
      status: isJobStatus(status) ? status : undefined,
      subject: searchParams.get("subject") ?? undefined,
      urgent: urgent === null ? undefined : urgent === "true",
    };

    return Response.json(await listMyJobs(filters));
  } catch (error) {
    return routeError(error);
  }
}

function isJobStatus(value: string | null): value is NonNullable<JobListFilters["status"]> {
  return value === "ACTIVE" || value === "CLOSED" || value === "DRAFT" || value === "EXPIRED" || value === "SUSPENDED";
}

function readNumber(value: string | null) {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
