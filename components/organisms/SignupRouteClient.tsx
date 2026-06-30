"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { startRouteLoading } from "@/lib/navigation-loading";
import { loadAppState, saveAppState } from "@/lib/supplyed-storage";
import type { AppState } from "@/types/supplyed";

import { PageLoader, PublicThemeControls } from "../molecules";
import { SignupAccessPage } from "./SignupAccessPage";
import { SignupVerifyPage } from "./SignupVerifyPage";

type SignupStage = "account" | "verify";

function resolveSignupStage(state: AppState): SignupStage {
  if (state.signupEmail && !state.signupVerified && !state.onboardingComplete) return "verify";
  return "account";
}

function SignupRouteClientInner() {
  const router = useRouter();
  const [state, setState] = useState<AppState>(() => ({
    ...loadAppState(),
    auth: "onboarding",
  }));
  const [stage, setStage] = useState<SignupStage>(() => resolveSignupStage({ ...loadAppState(), auth: "onboarding" }));

  useEffect(() => {
    saveAppState(state);
  }, [state]);

  function startVerification(email: string) {
    const nextState: AppState = {
      ...state,
      auth: "onboarding",
      signupEmail: email,
      signupVerified: false,
      roleSelected: false,
      onboardingComplete: false,
      applicationStatus: "none",
      onboardingStep: 1,
    };
    setState(nextState);
    saveAppState(nextState);
    setStage("verify");
  }

  function backToAccount() {
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
    setStage("account");
  }

  function finishVerification() {
    const nextState: AppState = {
      ...state,
      auth: "signed-in",
      signupVerified: true,
      roleSelected: false,
      onboardingComplete: false,
      applicationStatus: "none",
      onboardingStep: 1,
    };
    setState(nextState);
    saveAppState(nextState);
    startRouteLoading();
    router.push("/onboarding");
  }

  function goLanding() {
    const nextState: AppState = { ...state, auth: "landing" };
    setState(nextState);
    saveAppState(nextState);
    startRouteLoading();
    router.push("/");
  }

  function goLogin() {
    const nextState: AppState = { ...state, auth: "login" };
    setState(nextState);
    saveAppState(nextState);
    startRouteLoading();
    router.push("/login");
  }

  if (stage === "account") {
    return (
      <>
        <SignupAccessPage
          onAccountCreated={startVerification}
          onLanding={goLanding}
          onLogin={goLogin}
        />
        <PublicThemeControls />
      </>
    );
  }

  if (stage === "verify") {
    return (
      <>
        <SignupVerifyPage
          email={state.signupEmail}
          onBack={backToAccount}
          onLanding={goLanding}
          onLogin={goLogin}
          onVerified={finishVerification}
        />
        <PublicThemeControls />
      </>
    );
  }

  return null;
}

export function SignupRouteClient() {
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!isClient) {
    return (
      <PageLoader
        description="Preparing account creation and verification state."
        title="Preparing signup"
      />
    );
  }

  return <SignupRouteClientInner />;
}
