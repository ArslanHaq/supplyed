import { auth } from "@/auth";
import { uploadOnboardingDocumentAction } from "@/features/onboarding/actions";
import { getProfileDocumentRequirements } from "@/features/onboarding/documents";
import { getCurrentUser } from "@/features/auth/queries";
import { readLimitedFormData, requireSameOrigin } from "@/lib/server/upload-request";
import { ApiError } from "@/lib/server/api-client";
import { routeError } from "@/lib/server/route-error";

export async function POST(request: Request) {
  // Documents use their backend-configured limit rather than the Server Action limit.
  try {
    requireSameOrigin(request);
    const session = await auth();
    if (!session?.user?.isEmailVerified) {
      return Response.json({ ok: false, message: "Sign in again before uploading documents." }, { status: 401 });
    }
    // Preserve backend-configured document limits, including limits larger than 10 MiB.
    const currentUser = await getCurrentUser();
    const requirements = await getProfileDocumentRequirements(currentUser?.role ?? session.user.role);
    const maxFileBytes = Math.max(10 * 1024 * 1024, ...requirements.map((item) => item.maxSizeBytes));
    return Response.json(await uploadOnboardingDocumentAction(await readLimitedFormData(request, maxFileBytes)));
  } catch (error) {
    if (error instanceof ApiError) return Response.json({ ok: false, message: error.message }, { status: error.status });
    const response = routeError(error);
    return Response.json({ ok: false, ...(await response.json()) }, { status: response.status, headers: response.headers });
  }
}
