import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getOnboardingProfileSnapshot } from "@/features/onboarding/actions";
import { hasCreatedRoleProfile, profileEntryStatus } from "@/features/onboarding/profile-progress";
import { hasSubmittedApplicationStatus } from "@/lib/routes";
import { AppRouteShellClient } from "./organisms/RouteShell";
import { PublicJobsBrowser } from "./organisms/PublicJobsBrowser";
import type { AppPage } from "@/types/supplyed";

export async function AppRouteShell(props: { page: AppPage }) {
  const session = await auth();
  const browsePage = props.page === "find-jobs" || props.page === "job-detail";
  if (browsePage && (!session?.user || !session.user.isEmailVerified))
    return (
      <Suspense fallback={null}>
        <PublicJobsBrowser page={props.page as "find-jobs" | "job-detail"} />
      </Suspense>
    );

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.authErrorMessage) {
    redirect(`/post-auth?authSource=login`);
  }

  if (!session.user.isEmailVerified) {
    redirect("/post-auth");
  }

  const snapshot = process.env.API_BASE_URL ? await getOnboardingProfileSnapshot() : null;
  const role = snapshot ? snapshot.role : session.user.role;
  const applicationStatus = snapshot ? profileEntryStatus(snapshot) : session.user.applicationStatus;
  if (browsePage && !role)
    return (
      <Suspense fallback={null}>
        <PublicJobsBrowser page={props.page as "find-jobs" | "job-detail"} />
      </Suspense>
    );
  if (!role || (snapshot ? !hasCreatedRoleProfile(snapshot) : !hasSubmittedApplicationStatus(applicationStatus))) {
    redirect("/onboarding");
  }

  return (
    <Suspense fallback={null}>
      <AppRouteShellClient
        {...props}
        sessionState={{
          applicationStatus,
          email: session.user.email ?? "",
          name: session.user.name,
          role,
        }}
      />
    </Suspense>
  );
}
