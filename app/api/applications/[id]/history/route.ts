import { api } from "@/lib/server/api-client";
import { routeError } from "@/lib/server/route-error";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return Response.json(await api.get(`/applications/${id}/history`, { cache: "no-store" }));
  } catch (error) {
    return routeError(error);
  }
}
