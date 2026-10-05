import { getUnreadMessageCount } from "@/features/conversations/queries";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getUnreadMessageCount());
  } catch (error) {
    return routeError(error);
  }
}
