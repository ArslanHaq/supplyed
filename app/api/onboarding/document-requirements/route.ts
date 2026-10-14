import { auth } from "@/auth";
import { getProfileDocumentRequirements } from "@/features/onboarding/documents";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    return Response.json(await getProfileDocumentRequirements(session?.user.role));
  } catch (error) {
    return routeError(error);
  }
}
