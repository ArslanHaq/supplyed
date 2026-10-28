import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getOnboardingProfileSnapshot } from "@/features/onboarding/actions";
import { profileEntryStatus } from "@/features/onboarding/profile-progress";
import { hasSubmittedApplicationStatus, getAuthenticatedEntryHref, shouldShowApplicationStatusPage } from "@/lib/routes";
import { AppRouteShellClient } from "./organisms/RouteShell";
import type { AppPage, RouteContext } from "@/types/supplyed";
import { invitationLoginHref } from "@/lib/invitation-links";

export async function AppRouteShell(props: { page: AppPage; initialContext?: RouteContext }) {
  const session = await auth();
  const invitationPath = props.page === "job-invitations" ? props.initialContext?.invitationId ? `/job-invitations/${props.initialContext.invitationId}` : "/job-invitations" : undefined;
  const returnQuery = invitationPath ? `&returnTo=${encodeURIComponent(invitationPath)}` : "";

  if (!session?.user) {
    redirect(invitationLoginHref(invitationPath));
  }

  if (session.user.authErrorMessage) {
    redirect(`/post-auth?authSource=login${returnQuery}`);
  }

  if (!session.user.isEmailVerified) {
    redirect(`/post-auth?authSource=login${returnQuery}`);
  }

  const isAdmin = session.user.role === "admin";
  const snapshot = process.env.API_BASE_URL && !isAdmin ? await getOnboardingProfileSnapshot() : null;
  const role = snapshot ? snapshot.role : session.user.role;
  const applicationStatus = isAdmin ? "approved" : snapshot ? profileEntryStatus(snapshot) : session.user.applicationStatus;
  if (!role || (role !== "admin" && !hasSubmittedApplicationStatus(applicationStatus))) {
    redirect(invitationPath ? `/onboarding?returnTo=${encodeURIComponent(invitationPath)}` : "/onboarding");
  }

  if (shouldShowApplicationStatusPage(role, applicationStatus) && props.page !== "dashboard") {
    redirect(getAuthenticatedEntryHref({ applicationStatus, role }));
  }

  return (
    <Suspense fallback={null}>
      <AppRouteShellClient
        {...props}
        sessionState={{
          id: session.user.id,
          applicationStatus,
          email: session.user.email ?? "",
          name: session.user.name,
          role,
        }}
      />
    </Suspense>
  );
}
