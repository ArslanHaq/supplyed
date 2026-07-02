import { getCurrentUser } from "@/features/auth/queries";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getCurrentUser());
  } catch (error) {
    return routeError(error);
  }
}
