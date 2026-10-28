import { getConversation } from "@/features/conversations/queries";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { return Response.json(await getConversation((await context.params).id)); }
  catch (error) { return routeError(error); }
}
