import { getSettingsProfileSnapshot } from "@/features/settings/queries";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getSettingsProfileSnapshot());
  } catch (error) {
    return routeError(error);
  }
}
