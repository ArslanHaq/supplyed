import { getSchoolBillingSettings } from "@/features/payments/queries";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getSchoolBillingSettings(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return routeError(error);
  }
}
