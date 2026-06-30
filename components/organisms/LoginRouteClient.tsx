"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { startRouteLoading } from "@/lib/navigation-loading";
import { buildAppHref } from "@/lib/routes";
import { loadAppState, saveAppState } from "@/lib/supplyed-storage";
import type { AppPage, AppState } from "@/types/supplyed";

import { PageLoader, PublicThemeControls } from "../molecules";
import { LoginPage } from "./LoginPage";

type LoginChallenge = "email-verification" | "identity-verification";

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

  function isUnverifiedAccountEmail(email: string) {
    const savedEmail = state.signupEmail.trim().toLowerCase();
    return Boolean(savedEmail && savedEmail === email.trim().toLowerCase() && !state.signupVerified);
  }

  function handleCredentialsAccepted(email: string): LoginChallenge {
    return isUnverifiedAccountEmail(email) ? "email-verification" : "identity-verification";
  }

  function verifyEmailForLogin(email: string) {
    const nextState: AppState = {
      ...state,
      auth: "login",
      signupEmail: state.signupEmail || email,
      signupVerified: true,
    };
    setState(nextState);
    saveAppState(nextState);
  }

  function finishLogin(email: string) {
    const signedInState: AppState = {
      ...state,
      auth: "signed-in",
      signupEmail: state.signupEmail || email,
      signupVerified: true,
    };

    if (!signedInState.roleSelected || !signedInState.onboardingComplete) {
      const nextState: AppState = {
        ...signedInState,
        onboardingStep: signedInState.roleSelected ? signedInState.onboardingStep : 1,
      };
      setState(nextState);
      saveAppState(nextState);
      startRouteLoading();
      router.push("/onboarding");
      return;
    }

    const nextPage: AppPage = signedInState.role === "admin" ? "admin" : "dashboard";
    const nextState: AppState = { ...signedInState, page: nextPage };
    setState(nextState);
    saveAppState(nextState);
    startRouteLoading();
    router.push(buildAppHref(nextPage));
  }

  return (
    <>
      <LoginPage
        onCredentialsAccepted={handleCredentialsAccepted}
        onEmailVerified={verifyEmailForLogin}
        onForgotPassword={goForgotPassword}
        onLanding={goLanding}
        onLogin={finishLogin}
        onSwitchSignup={goSignup}
      />
      <PublicThemeControls />
    </>
  );
}

export function LoginRouteClient() {
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!isClient) {
    return (
      <PageLoader
        description="Checking saved session state before showing sign in."
        title="Preparing secure sign in"
      />
    );
  }

  return <LoginRouteClientInner />;
}
