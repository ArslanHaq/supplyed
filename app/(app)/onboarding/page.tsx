import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { OnboardingRouteClient } from "@/components/organisms/OnboardingRouteClient";
import { getOnboardingProfileSnapshot } from "@/features/onboarding/actions";
import { createVerifiedEmailSessionTicket } from "@/features/auth/session-ticket";
import type { BackendAuthResponse } from "@/features/auth/types";
import { getServerAuthContext } from "@/lib/server/auth-context";
import { noIndexMetadata } from "@/lib/seo";
import type { OnboardingProfileSnapshot } from "@/features/onboarding/types";
import { profileEntryStatus } from "@/features/onboarding/profile-progress";
import { ApiError } from "@/lib/server/api-client";
import { WorkspaceStatusUnavailable } from "@/components/organisms/WorkspaceStatusUnavailable";
import { summarizeOnboardingProfile } from "@/features/onboarding/snapshot";
import { queryKeys } from "@/lib/query/keys";
import { authReturnPath, loginHref } from "@/lib/invitation-links";

export const metadata = noIndexMetadata("Onboarding", "Complete your SupplyED account setup.");

function readOptional(value: string | null | undefined) {
  return value || undefined;
}

async function createSessionRepairTicket(session: Session, snapshot: OnboardingProfileSnapshot) {
  const authContext = await getServerAuthContext(session);
  const user = session.user;
  const email = user.email ?? authContext?.email;

  if (!authContext || !user.id || !email || !user.isEmailVerified) return undefined;

  const instructorProfileId = snapshot.instructor?.id ?? authContext.instructorProfileId ?? user.instructorProfileId;
  const institutionProfileId = snapshot.institution?.id ?? authContext.institutionProfileId ?? user.institutionProfileId;
  const applicationStatus = profileEntryStatus(snapshot);
  const role = snapshot.role;
  const needsRepair =
    applicationStatus !== user.applicationStatus || role !== user.role ||
    instructorProfileId !== user.instructorProfileId ||
    institutionProfileId !== user.institutionProfileId;

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
      name: user.name ?? snapshot.instructor?.fullName ?? snapshot.institution?.name ?? null,
      role,
    },
  };

  return createVerifiedEmailSessionTicket(response);
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const session = await auth();
  const returnTo = authReturnPath((await searchParams).returnTo);

  if (!session?.user) {
    redirect(loginHref(returnTo));
  }
  if (!session.user.isEmailVerified) redirect(returnTo ? `/post-auth?returnTo=${encodeURIComponent(returnTo)}` : "/post-auth");
  if (session.user.role === "admin") redirect("/dashboard");

  let snapshot;
  try {
    snapshot = await getOnboardingProfileSnapshot();
  } catch (error) {
    if (isWorkspaceStatusUnavailable(error)) {
      return <WorkspaceStatusUnavailable key={error.requestId ?? error.receivedAt} retryAfter={error.status === 429 ? error.retryAfter ?? 60 : 0} />;
    }
    throw error;
  }
  const sessionRepairTicket = await createSessionRepairTicket(session, snapshot);
  const queryClient = new QueryClient();
  queryClient.setQueryData([...queryKeys.onboarding.current(), session.user.email ?? ""], summarizeOnboardingProfile(snapshot));
  queryClient.setQueryData(queryKeys.auth.me(), {
    applicationStatus: profileEntryStatus(snapshot),
    email: session.user.email ?? "",
    emailVerified: session.user.isEmailVerified,
    id: session.user.id,
    instructorProfileId: snapshot.instructor?.id ?? session.user.instructorProfileId,
    institutionProfileId: snapshot.institution?.id ?? session.user.institutionProfileId,
    name: session.user.name ?? snapshot.instructor?.fullName ?? snapshot.institution?.name ?? null,
    phone: snapshot.user?.phone,
    phoneVerified: snapshot.user?.phoneVerified,
    role: snapshot.role,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OnboardingRouteClient
        accountEmail={session.user.email ?? ""}
        initialApplicationStatus={profileEntryStatus(snapshot)}
        initialProfileSnapshot={snapshot}
        initialRole={snapshot.role}
        sessionRepairTicket={sessionRepairTicket}
      />
    </HydrationBoundary>
  );
}

function isWorkspaceStatusUnavailable(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.status === 404 || error.status === 408 || error.status === 429 || error.status >= 500);
}
