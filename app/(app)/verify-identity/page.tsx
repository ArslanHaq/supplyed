import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { VerifyIdentityPage } from "@/components/organisms/VerifyIdentityPage";
import { getMyIdentityVerification } from "@/features/identity-verification/queries";
import { getOnboardingProfileSnapshot } from "@/features/onboarding/actions";
import { profileEntryStatus } from "@/features/onboarding/profile-progress";
import { getAuthenticatedEntryHref } from "@/lib/routes";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("Verify your identity", "Verify your identity and right to work with TrustID.");

/** The identity step of opening a teacher account. It comes once the teaching profile exists. */
export default async function VerifyIdentityRoute() {
  const session = await auth();

  if (!session?.user) redirect("/login");
  if (!session.user.isEmailVerified) redirect("/post-auth");
  if (session.user.role === "admin") redirect("/dashboard");

  const snapshot = await getOnboardingProfileSnapshot();

  if (snapshot.role !== "teacher" || !snapshot.instructor) redirect("/onboarding");

  // The page loads it again in the browser if this fails.
  const identity = await getMyIdentityVerification().catch(() => null);

  return (
    <VerifyIdentityPage
      continueHref={getAuthenticatedEntryHref({ applicationStatus: profileEntryStatus(snapshot), role: "teacher" })}
      initialIdentity={identity}
      user={{ phone: snapshot.user?.phone ?? "", phoneVerified: snapshot.user?.phoneVerified ?? false }}
    />
  );
}
