import { getJob } from "@/features/jobs/queries";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const job = await getJob(id);

    if (!job) {
      return Response.json({ message: "Job not found." }, { status: 404 });
    }

    return Response.json(job);
  } catch (error) {
    return routeError(error);
  }
}
