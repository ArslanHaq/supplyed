import { listMyConversations } from "@/features/conversations/queries";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await listMyConversations());
  } catch (error) {
    return routeError(error);
  }
}
