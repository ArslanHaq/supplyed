import { normalizeRole } from "@/features/auth/backend";
import { getProfileDocumentRequirements } from "@/features/onboarding/documents";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const role = normalizeRole(new URL(request.url).searchParams.get("role"));
    return Response.json(await getProfileDocumentRequirements(role));
  } catch (error) {
    return routeError(error);
  }
}
