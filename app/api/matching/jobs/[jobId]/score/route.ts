import { getJobMatchScore } from "@/features/matching/queries";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await context.params;
    return Response.json(await getJobMatchScore(jobId));
  } catch (error) {
    return routeError(error);
  }
}
