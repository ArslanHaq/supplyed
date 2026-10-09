import { listInstructorReviews } from "@/features/reviews/queries";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ instructorId: string }> }) {
  try {
    const { instructorId } = await context.params;
    return Response.json(await listInstructorReviews(instructorId));
  } catch (error) {
    return routeError(error);
  }
}
