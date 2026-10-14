import { getInstructorPayoutAccount } from "@/features/payments/admin-payout-queries";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ instructorId: string }> }) {
  try {
    const { instructorId } = await context.params;
    return Response.json(await getInstructorPayoutAccount(instructorId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return routeError(error);
  }
}
