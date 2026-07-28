import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { hasSubmittedApplicationStatus, getAuthenticatedEntryHref, shouldShowApplicationStatusPage } from "@/lib/routes";
import { AppRouteShellClient } from "./organisms/RouteShell";
import type { AppPage } from "@/types/supplyed";

export async function AppRouteShell(props: { page: AppPage }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!session.user.isEmailVerified) {
    redirect("/post-auth");
  }

  const role = session.user.role;
  const applicationStatus = session.user.applicationStatus;
  if (!role || !hasSubmittedApplicationStatus(applicationStatus)) {
    redirect("/onboarding");
  }

  if (shouldShowApplicationStatusPage(role, applicationStatus) && props.page !== "dashboard") {
    redirect(getAuthenticatedEntryHref({ applicationStatus, role }));
  }

  return (
    <Suspense fallback={null}>
      <AppRouteShellClient
        {...props}
        sessionState={{
          applicationStatus: session.user.applicationStatus,
          email: session.user.email ?? "",
          name: session.user.name,
          role,
        }}
      />
    </Suspense>
  );
}
