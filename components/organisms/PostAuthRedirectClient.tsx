"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";

import { startRouteLoading } from "@/lib/navigation-loading";
import { buildAppHref } from "@/lib/routes";
import { loadAppState, resetAuthFlowState, saveAppState } from "@/lib/supplyed-storage";
import type { AppRole, ApplicationStatus, AppState } from "@/types/supplyed";

import { AuthFlowLoader } from "../molecules";

type PostAuthSessionUser = {
  applicationStatus: ApplicationStatus;
  authErrorMessage?: string;
  authErrorProvider?: string;
  email: string;
  emailVerified: boolean;
  role: AppRole | null;
};

function resolveNextState(savedState: AppState, sessionUser: PostAuthSessionUser): AppState {
  const sessionHasRole = Boolean(sessionUser.role);
  const role = sessionUser.role ?? savedState.role;
  const onboardingComplete =
    sessionUser.role === "admin" || (sessionHasRole && sessionUser.applicationStatus !== "none");

  return {
    ...savedState,
    applicationStatus: sessionUser.applicationStatus,
    auth: "signed-in",
    role,
    roleSelected: sessionHasRole,
    onboardingComplete,
    onboardingStep: sessionHasRole ? savedState.onboardingStep : 1,
    signupEmail: sessionUser.email || savedState.signupEmail,
    signupVerified: sessionUser.emailVerified,
  };
}

export function PostAuthRedirectClient({ sessionUser }: { sessionUser: PostAuthSessionUser }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const authSource = searchParams.get("authSource") === "signup" ? "signup" : "login";

    const nextState = resolveNextState(loadAppState(), sessionUser);
    saveAppState(nextState);
    startRouteLoading();

    if (sessionUser.authErrorMessage) {
      void signOut({ redirect: false }).finally(() => {
        const params = new URLSearchParams({ auth_error: sessionUser.authErrorMessage ?? "Social sign-in failed." });
        saveAppState(resetAuthFlowState(loadAppState(), authSource === "signup" ? "onboarding" : "login"));
        router.replace(`/${authSource}?${params.toString()}`);
      });
      return;
    }

    if (!sessionUser.emailVerified) {
      void signOut({ redirect: false }).finally(() => {
        saveAppState(resetAuthFlowState(loadAppState(), "login"));
        router.replace("/login");
      });
      return;
    }

    if (!nextState.roleSelected || !nextState.onboardingComplete) {
      router.replace("/onboarding");
      return;
    }

    router.replace(buildAppHref(nextState.role === "admin" ? "admin" : "dashboard"));
  }, [router, searchParams, sessionUser]);

  return (
    <AuthFlowLoader
      description="Checking your account role and application status."
      title="Preparing your workspace"
    />
  );
}
