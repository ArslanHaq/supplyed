import { getUnreadNotificationCount } from "@/features/notifications/queries";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getUnreadNotificationCount());
  } catch (error) {
    return routeError(error);
  }
}
