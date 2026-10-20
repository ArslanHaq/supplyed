import { listApplicationHistory } from "@/features/applications/queries";
import { assertValidQuery } from "@/lib/server/query-validation";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const searchParams = new URL(request.url).searchParams;
    assertValidQuery(searchParams, {});
    return Response.json(await listApplicationHistory(id, {
      limit: Number(searchParams.get("limit") ?? 20),
      page: Number(searchParams.get("page") ?? 1),
    }));
  } catch (error) {
    return routeError(error);
  }
}
