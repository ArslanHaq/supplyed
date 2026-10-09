import { getMyPayoutBalance } from "@/features/payments/queries";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getMyPayoutBalance());
  } catch (error) {
    return routeError(error);
  }
}
