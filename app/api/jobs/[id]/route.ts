import { getJob, getMyJob } from "@/features/jobs/queries";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const ownerView = searchParams.get("scope") === "mine";
    const job = ownerView ? (await getMyJob(id)) ?? (await getJob(id)) : await getJob(id);

    if (!job) {
      return Response.json({ message: "Job not found." }, { status: 404 });
    }

    return Response.json(job);
  } catch (error) {
    return routeError(error);
  }
}