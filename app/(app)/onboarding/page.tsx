import { redirect } from "next/navigation";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { OnboardingRouteClient } from "@/components/organisms/OnboardingRouteClient";
import { getOnboardingProfileSnapshot } from "@/features/onboarding/actions";
import { createVerifiedEmailSessionTicket } from "@/features/auth/session-ticket";
import type { BackendAuthResponse } from "@/features/auth/types";
import { getServerAuthContext } from "@/lib/server/auth-context";
import { noIndexMetadata } from "@/lib/seo";
import type { OnboardingProfileSnapshot } from "@/features/onboarding/types";

export const metadata = noIndexMetadata("Onboarding", "Complete your SupplyED account setup.");

function readOptional(value: string | null | undefined) {
  return value || undefined;
}

async function createSessionRepairTicket(session: Session, snapshot: OnboardingProfileSnapshot) {
  const authContext = await getServerAuthContext();
  const user = session.user;
  const email = user.email ?? authContext?.email;

  if (!authContext || !user.id || !email || !user.isEmailVerified) return undefined;

  const instructorProfileId = snapshot.instructor?.id ?? authContext.instructorProfileId ?? user.instructorProfileId;
  const institutionProfileId = snapshot.institution?.id ?? authContext.institutionProfileId ?? user.institutionProfileId;
  const recruiterProfileId = snapshot.recruiter?.id ?? authContext.recruiterProfileId ?? user.recruiterProfileId;
  const applicationStatus = snapshot.applicationStatus !== "none" ? snapshot.applicationStatus : user.applicationStatus;
  const role = user.role ?? snapshot.role;
  const needsRepair =
    applicationStatus !== user.applicationStatus ||
    instructorProfileId !== user.instructorProfileId ||
    institutionProfileId !== user.institutionProfileId ||
    recruiterProfileId !== user.recruiterProfileId;

  if (!needsRepair) return undefined;

  const response: BackendAuthResponse = {
    accessToken: readOptional(authContext.accessToken),
    accessTokenExpiresAt: authContext.accessTokenExpiresAt ?? undefined,
    refreshToken: readOptional(authContext.refreshToken),
    user: {
      applicationStatus,
      email,
      emailVerified: true,
      id: user.id,
      instructorProfileId: readOptional(instructorProfileId),
      institutionProfileId: readOptional(institutionProfileId),
      recruiterProfileId: readOptional(recruiterProfileId),
      name: user.name ?? snapshot.instructor?.fullName ?? snapshot.institution?.name ?? snapshot.recruiter?.displayName ?? null,
      role,
    },
  };

  return createVerifiedEmailSessionTicket(response);
}

export default async function OnboardingPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const snapshot = await getOnboardingProfileSnapshot();
  const sessionRepairTicket = await createSessionRepairTicket(session, snapshot);

  return (
    <OnboardingRouteClient
      accountEmail={session.user.email ?? ""}
      initialApplicationStatus={session.user.applicationStatus}
      initialProfileSnapshot={snapshot}
      initialRole={session.user.role}
      sessionRepairTicket={sessionRepairTicket}
    />
  );
}
