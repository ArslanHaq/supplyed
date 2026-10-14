import { listInstitutionReviews } from "@/features/reviews/queries";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ institutionId: string }> }) {
  try {
    const { institutionId } = await context.params;
    return Response.json(await listInstitutionReviews(institutionId));
  } catch (error) {
    return routeError(error);
  }
}
