import { getNotificationPreferences } from "@/features/notifications/queries";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getNotificationPreferences());
  } catch (error) {
    return routeError(error);
  }
}
