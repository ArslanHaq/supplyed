import { getRecommendedJobs } from "@/features/matching/queries";
import { routeError } from "@/lib/server/route-error";
import { assertValidQuery } from "@/lib/server/query-validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    assertValidQuery(params, { minScore: { min: 0, max: 100 } });
    return Response.json(await getRecommendedJobs({ limit: Number(params.get("limit") ?? 20), minScore: Number(params.get("minScore") ?? 0), page: Number(params.get("page") ?? 1) }));
  } catch (error) {
    return routeError(error);
  }
}
