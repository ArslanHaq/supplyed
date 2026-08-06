import { listApplicationsByJob } from "@/features/applications/queries";
import type { JobApplicationsQuery } from "@/features/applications/types";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await context.params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const query: JobApplicationsQuery = {
      limit: Number(searchParams.get("limit") ?? 20),
      page: Number(searchParams.get("page") ?? 1),
      status:
        status === "APPLIED" ||
        status === "COMPLETED" ||
        status === "HIRED" ||
        status === "INTERVIEW" ||
        status === "REJECTED" ||
        status === "SHORTLISTED" ||
        status === "VIEWED"
          ? status
          : undefined,
    };

    return Response.json(await listApplicationsByJob(jobId, query));
  } catch (error) {
    return routeError(error);
  }
}
