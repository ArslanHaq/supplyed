import { Suspense } from "react";
import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";

import { auth } from "@/auth";
import { getOnboardingSnapshot } from "@/features/onboarding/queries";
import { queryKeys } from "@/lib/query/keys";
import { ApiError } from "@/lib/server/api-client";
import { getServerAuthContext } from "@/lib/server/auth-context";
import { WorkspaceStatusUnavailable } from "./organisms/WorkspaceStatusUnavailable";
import { buildAppHref, hasSubmittedApplicationStatus, getAuthenticatedEntryHref, isAppPageAllowedForRole, shouldShowApplicationStatusPage } from "@/lib/routes";
import { AppRouteShellClient } from "./organisms/RouteShell";
import type { AppPage, RouteContext } from "@/types/supplyed";
import { authReturnPath, loginHref } from "@/lib/invitation-links";

export async function AppRouteShell(props: { page: AppPage; initialContext?: RouteContext }) {
  const session = await auth();
  const returnPath = authReturnPath(buildAppHref(props.page, props.initialContext));
  const returnQuery = returnPath ? `&returnTo=${encodeURIComponent(returnPath)}` : "";

  if (!session?.user) {
    redirect(loginHref(returnPath));
  }

  if (session.user.authErrorMessage) {
    redirect(`/post-auth?authSource=login${returnQuery}`);
  }

  if (!session.user.isEmailVerified) {
    redirect(`/post-auth?authSource=login${returnQuery}`);
  }

  const isAdmin = session.user.role === "admin";
  let snapshot = null;
  try {
    snapshot = process.env.API_BASE_URL && !isAdmin
      ? await getOnboardingSnapshot(await getServerAuthContext(session))
      : null;
  } catch (error) {
    if (isWorkspaceStatusUnavailable(error)) {
      return <WorkspaceStatusUnavailable key={error.requestId ?? error.receivedAt} retryAfter={error.status === 429 ? error.retryAfter ?? 60 : 0} />;
    }
    throw error;
  }
  const role = snapshot ? snapshot.role : session.user.role;
  const applicationStatus = isAdmin ? "approved" : snapshot ? snapshot.applicationStatus : session.user.applicationStatus;
  if (!role || (role !== "admin" && !hasSubmittedApplicationStatus(applicationStatus))) {
    redirect(returnPath ? `/onboarding?returnTo=${encodeURIComponent(returnPath)}` : "/onboarding");
  }

  if (shouldShowApplicationStatusPage(role, applicationStatus) && props.page !== "dashboard") {
    redirect(getAuthenticatedEntryHref({ applicationStatus, role }));
  }

  if (!isAppPageAllowedForRole(props.page, role)) {
    redirect(getAuthenticatedEntryHref({ applicationStatus, role }));
  }

  const queryClient = new QueryClient();
  if (snapshot) queryClient.setQueryData([...queryKeys.onboarding.current(), session.user.email ?? ""], snapshot);
  queryClient.setQueryData(queryKeys.auth.me(), {
    applicationStatus,
    email: session.user.email ?? "",
    emailVerified: session.user.isEmailVerified,
    id: session.user.id,
    instructorProfileId: session.user.instructorProfileId,
    institutionProfileId: session.user.institutionProfileId,
    name: session.user.name,
    role,
  });

  return (
    <Suspense fallback={null}>
      <HydrationBoundary state={dehydrate(queryClient)}>
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
      </HydrationBoundary>
    </Suspense>
  );
}

function isWorkspaceStatusUnavailable(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.status === 404 || error.status === 408 || error.status === 429 || error.status >= 500);
}
