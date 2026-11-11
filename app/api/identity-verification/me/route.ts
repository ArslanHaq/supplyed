import { getMyIdentityVerification } from "@/features/identity-verification/queries";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getMyIdentityVerification());
  } catch (error) {
    return routeError(error);
  }
}
