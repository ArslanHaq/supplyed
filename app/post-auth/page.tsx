import { getOAuthChallenge } from "@/lib/server/oauth-challenge";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getOnboardingSnapshot } from "@/features/onboarding/queries";
import { ApiError } from "@/lib/server/api-client";
import { getServerAuthContext } from "@/lib/server/auth-context";
import { WorkspaceStatusUnavailable } from "@/components/organisms/WorkspaceStatusUnavailable";
import { PostAuthRedirectClient } from "@/components/organisms/PostAuthRedirectClient";
import { noIndexMetadata } from "@/lib/seo";
import { authReturnPath, loginHref } from "@/lib/invitation-links";

export const metadata = noIndexMetadata("Preparing account");

export default async function PostAuthPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  if (await getOAuthChallenge()) redirect("/two-factor");
  const session = await auth();
  const returnTo = authReturnPath((await searchParams).returnTo);

  if (!session?.user) {
    redirect(loginHref(returnTo));
  }

  let snapshot = null;
  try {
    snapshot = process.env.API_BASE_URL && session.user.role !== "admin" && session.user.isEmailVerified && !session.user.authErrorMessage
      ? await getOnboardingSnapshot(await getServerAuthContext(session)) : null;
  } catch (error) {
    if (isWorkspaceStatusUnavailable(error)) {
      return <WorkspaceStatusUnavailable key={error.requestId ?? error.receivedAt} retryAfter={error.status === 429 ? error.retryAfter ?? 60 : 0} />;
    }
    throw error;
  }

  return (
    <PostAuthRedirectClient
      sessionUser={{
        applicationStatus: session.user.role === "admin" ? "approved" : snapshot ? snapshot.applicationStatus : session.user.applicationStatus,
        authErrorMessage: session.user.authErrorMessage,
        authErrorProvider: session.user.authErrorProvider,
        email: session.user.email ?? "",
        emailVerified: session.user.isEmailVerified,
        role: snapshot ? snapshot.role : session.user.role,
      }}
    />
  );
}

function isWorkspaceStatusUnavailable(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.status === 404 || error.status === 408 || error.status === 429 || error.status >= 500);
}
