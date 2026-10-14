"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";

import { startRouteLoading } from "@/lib/navigation-loading";
import { getAuthenticatedEntryHref } from "@/lib/routes";
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
        const googleNeedsRole = sessionUser.authErrorProvider === "google" && /role is required to create an account with google/i.test(sessionUser.authErrorMessage ?? "");
        const params = new URLSearchParams({
          auth_error: googleNeedsRole
            ? "Choose whether you are a teacher or a school, then continue with Google again."
            : sessionUser.authErrorMessage ?? "Social sign-in failed.",
        });
        router.replace(`/${googleNeedsRole ? "signup" : authSource}?${params.toString()}`);
      });
      return;
    }

    if (!sessionUser.emailVerified) {
      void signOut({ redirect: false }).finally(() => {
        router.replace("/login");
      });
      return;
    }

    router.replace(getAuthenticatedEntryHref(sessionUser));
  }, [router, searchParams, sessionUser]);

  return (
    <AuthFlowLoader
      description="Checking your account role and application status."
      title="Preparing your workspace"
    />
  );
}
