import { getOnboardingSnapshot } from "@/features/onboarding/queries";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getOnboardingSnapshot());
  } catch (error) {
    return routeError(error);
  }
}
