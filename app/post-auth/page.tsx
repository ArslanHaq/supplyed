import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getOnboardingProfileSnapshot } from "@/features/onboarding/actions";
import { profileEntryStatus } from "@/features/onboarding/profile-progress";
import { PostAuthRedirectClient } from "@/components/organisms/PostAuthRedirectClient";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("Preparing account");

export default async function PostAuthPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const snapshot = process.env.API_BASE_URL && session.user.isEmailVerified && !session.user.authErrorMessage
    ? await getOnboardingProfileSnapshot()
    : null;

  return (
    <PostAuthRedirectClient
      sessionUser={{
        applicationStatus: snapshot ? profileEntryStatus(snapshot) : session.user.applicationStatus,
        authErrorMessage: session.user.authErrorMessage,
        authErrorProvider: session.user.authErrorProvider,
        email: session.user.email ?? "",
        emailVerified: session.user.isEmailVerified,
        role: snapshot ? snapshot.role : session.user.role,
      }}
    />
  );
}
