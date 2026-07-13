"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { startRouteLoading } from "@/lib/navigation-loading";
import { loadAppState, saveAppState } from "@/lib/supplyed-storage";
import { useMounted } from "@/lib/use-mounted";
import type { AppState } from "@/types/supplyed";

import { AuthFlowLoader, PublicThemeControls } from "../molecules";
import { LoginPage } from "./LoginPage";

function LoginRouteClientInner() {
  const router = useRouter();
  const [state, setState] = useState<AppState>(() => ({ ...loadAppState(), auth: "login" }));

  useEffect(() => {
    saveAppState(state);
  }, [state]);

  function goLanding() {
    const nextState: AppState = { ...state, auth: "landing" };
    setState(nextState);
    saveAppState(nextState);
    startRouteLoading();
    router.push("/");
  }

  function goSignup() {
    const nextState: AppState = {
      ...state,
      auth: "onboarding",
      signupEmail: "",
      signupVerified: false,
      roleSelected: false,
      onboardingComplete: false,
      applicationStatus: "none",
      onboardingStep: 1,
    };
    setState(nextState);
    saveAppState(nextState);
    startRouteLoading();
    router.push("/signup");
  }

  function goForgotPassword() {
    startRouteLoading();
    router.push("/forgot-password");
  }

  async function finishLogin(email: string, password: string) {
    const result = await signIn("credentials", {
      email,
      password,
      flow: "password",
      redirect: false,
      redirectTo: "/post-auth",
    });

    if (!result?.ok) {
      return {
        message: "We could not sign you in with those details.",
        ok: false as const,
      };
    }

    const nextState: AppState = {
      ...state,
      auth: "signed-in",
      signupEmail: state.signupEmail || email,
      signupVerified: true,
    };
    setState(nextState);
    saveAppState(nextState);
    startRouteLoading();
    router.push("/post-auth");
    return { ok: true as const };
  }

  function startSocialAuth(provider: "google" | "microsoft-entra-id") {
    startRouteLoading();
    void signIn(provider, { redirectTo: "/post-auth" });
  }

  return (
    <>
      <LoginPage
        onForgotPassword={goForgotPassword}
        onGoogleAuth={() => startSocialAuth("google")}
        onLanding={goLanding}
        onLogin={finishLogin}
        onMicrosoftAuth={() => startSocialAuth("microsoft-entra-id")}
        onSwitchSignup={goSignup}
      />
      <PublicThemeControls />
    </>
  );
}

export function LoginRouteClient() {
  const isClient = useMounted();

  if (!isClient) {
    return (
      <AuthFlowLoader
        description="Checking saved session state before showing sign in."
        title="Preparing sign in"
      />
    );
  }

  return <LoginRouteClientInner />;
}
