import { listMyProfileReviews } from "@/features/my-profile/queries";
import type { ReviewDirection } from "@/features/my-profile/types";
import { assertValidQuery } from "@/lib/server/query-validation";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    assertValidQuery(searchParams, { direction: { values: ["received", "given"] }, limit: { min: 1, max: 20, integer: true } });
    return Response.json(await listMyProfileReviews({ page: Number(searchParams.get("page") || 1), limit: Number(searchParams.get("limit") || 6), direction: (searchParams.get("direction") || "received") as ReviewDirection }), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return routeError(error); }
}
