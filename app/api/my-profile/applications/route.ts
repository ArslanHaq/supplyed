import { listMyProfileApplications } from "@/features/my-profile/queries";
import { assertValidQuery } from "@/lib/server/query-validation";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    assertValidQuery(searchParams, { limit: { min: 1, max: 20, integer: true } });
    return Response.json(await listMyProfileApplications({ page: Number(searchParams.get("page") || 1), limit: Number(searchParams.get("limit") || 6) }), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return routeError(error); }
}
