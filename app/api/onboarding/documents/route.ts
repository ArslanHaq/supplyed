import { auth } from "@/auth";
import { uploadOnboardingDocumentAction } from "@/features/onboarding/actions";

export async function POST(request: Request) {
  // Uploads use a route so files are not restricted by the server action 1 MB limit.
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  if (!origin || new URL(origin).host !== host) {
    return Response.json({ ok: false, message: "Upload documents from your SupplyED account." }, { status: 403 });
  }

  try {
    const session = await auth();
    if (!session?.user?.isEmailVerified) {
      return Response.json({ ok: false, message: "Sign in again before uploading documents." }, { status: 401 });
    }
    return Response.json(await uploadOnboardingDocumentAction(await request.formData()));
  } catch {
    return Response.json({ ok: false, message: "The upload could not be completed. Please try again." }, { status: 500 });
  }
}
