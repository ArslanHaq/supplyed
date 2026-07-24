"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";

import { startRouteLoading } from "@/lib/navigation-loading";
import { buildAppHref } from "@/lib/routes";
import type { AppRole, ApplicationStatus } from "@/types/supplyed";

import { AuthFlowLoader } from "../molecules";

type PostAuthSessionUser = {
  applicationStatus: ApplicationStatus;
  authErrorMessage?: string;
  authErrorProvider?: string;
  email: string;
  emailVerified: boolean;
  role: AppRole | null;
};

export function PostAuthRedirectClient({ sessionUser }: { sessionUser: PostAuthSessionUser }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const authSource = searchParams.get("authSource") === "signup" ? "signup" : "login";
    startRouteLoading();

    if (sessionUser.authErrorMessage) {
      void signOut({ redirect: false }).finally(() => {
        const params = new URLSearchParams({ auth_error: sessionUser.authErrorMessage ?? "Social sign-in failed." });
        router.replace(`/${authSource}?${params.toString()}`);
      });
      return;
    }

    if (!sessionUser.emailVerified) {
      void signOut({ redirect: false }).finally(() => {
        router.replace("/login");
      });
      return;
    }

    const hasCompleteSetup =
      sessionUser.role === "admin" || Boolean(sessionUser.role && sessionUser.applicationStatus !== "none");

    if (!hasCompleteSetup) {
      router.replace("/onboarding");
      return;
    }

    router.replace(buildAppHref(sessionUser.role === "admin" ? "admin" : "dashboard"));
  }, [router, searchParams, sessionUser]);

  return (
    <AuthFlowLoader
      description="Checking your account role and application status."
      title="Preparing your workspace"
    />
  );
}
