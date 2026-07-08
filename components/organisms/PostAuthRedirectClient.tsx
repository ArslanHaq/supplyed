"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { startRouteLoading } from "@/lib/navigation-loading";
import { buildAppHref } from "@/lib/routes";
import { loadAppState, saveAppState } from "@/lib/supplyed-storage";
import type { AppRole, ApplicationStatus, AppState } from "@/types/supplyed";

import { AuthFlowLoader } from "../molecules";

type PostAuthSessionUser = {
  applicationStatus: ApplicationStatus;
  email: string;
  emailVerified: boolean;
  role: AppRole | null;
};

function resolveNextState(savedState: AppState, sessionUser: PostAuthSessionUser): AppState {
  const sessionHasRole = Boolean(sessionUser.role);
  const role = sessionUser.role ?? savedState.role;
  const roleSelected = sessionHasRole || savedState.roleSelected || savedState.onboardingComplete;

  return {
    ...savedState,
    applicationStatus: sessionUser.applicationStatus || savedState.applicationStatus,
    auth: "signed-in",
    role,
    roleSelected,
    signupEmail: sessionUser.email || savedState.signupEmail,
    signupVerified: sessionUser.emailVerified || savedState.signupVerified,
  };
}

export function PostAuthRedirectClient({ sessionUser }: { sessionUser: PostAuthSessionUser }) {
  const router = useRouter();

  useEffect(() => {
    const nextState = resolveNextState(loadAppState(), sessionUser);
    saveAppState(nextState);
    startRouteLoading();

    if (!nextState.signupVerified) {
      router.replace("/login");
      return;
    }

    if (!nextState.roleSelected || !nextState.onboardingComplete) {
      router.replace("/onboarding");
      return;
    }

    router.replace(buildAppHref(nextState.role === "admin" ? "admin" : "dashboard"));
  }, [router, sessionUser]);

  return (
    <AuthFlowLoader
      description="Checking your account role and application status."
      title="Preparing your workspace"
    />
  );
}
