"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { startRouteLoading } from "@/lib/navigation-loading";
import { buildAppHref } from "@/lib/routes";
import { loadAppState, saveAppState } from "@/lib/supplyed-storage";
import type { AppRole, AppState } from "@/types/supplyed";

import { PageLoader, PublicThemeControls } from "../molecules";
import { OnboardingPage } from "./OnboardingPage";

type SignupRole = Extract<AppRole, "institution" | "teacher" | "individual">;

function OnboardingRouteClientInner() {
  const router = useRouter();
  const [state, setState] = useState<AppState>(() => ({ ...loadAppState(), auth: "signed-in" }));

  useEffect(() => {
    saveAppState(state);
  }, [state]);

  useEffect(() => {
    if (!state.signupVerified) {
      startRouteLoading();
      router.replace("/signup");
      return;
    }

    if (state.onboardingComplete) {
      startRouteLoading();
      router.replace(buildAppHref("dashboard"));
    }
  }, [router, state.onboardingComplete, state.signupVerified]);

  function setRole(role: SignupRole) {
    setState((current) => ({ ...current, role, roleSelected: true, auth: "signed-in" }));
  }

  function setStep(step: number) {
    setState((current) => ({ ...current, auth: "signed-in", onboardingStep: step }));
  }

  function goLanding() {
    const nextState: AppState = { ...state, auth: "landing" };
    setState(nextState);
    saveAppState(nextState);
    startRouteLoading();
    router.push("/");
  }

  function exitOnboarding() {
    const nextState: AppState = { ...state, auth: "signed-in" };
    setState(nextState);
    saveAppState(nextState);
    startRouteLoading();
    router.push("/");
  }

  function finishOnboarding() {
    const nextStatus = state.role === "teacher" || state.role === "institution" ? "pending_review" : "approved";
    const nextState: AppState = {
      ...state,
      auth: "signed-in",
      roleSelected: true,
      onboardingComplete: true,
      applicationStatus: nextStatus,
      page: "dashboard",
    };
    setState(nextState);
    saveAppState(nextState);
    startRouteLoading();
    router.push(buildAppHref("dashboard"));
  }

  const activeRole: SignupRole = state.role === "teacher" ? "teacher" : state.role === "individual" ? "individual" : "institution";

  if (!state.signupVerified || state.onboardingComplete) return null;

  return (
    <>
      <OnboardingPage
        accountEmail={state.signupEmail}
        headerActionLabel="Exit"
        headerPrompt="Signed in"
        onFinish={finishOnboarding}
        onLanding={goLanding}
        onLogin={exitOnboarding}
        role={activeRole}
        roleSelected={state.roleSelected}
        setRole={setRole}
        setStep={setStep}
        step={state.onboardingStep}
      />
      <PublicThemeControls />
    </>
  );
}

export function OnboardingRouteClient() {
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!isClient) {
    return (
      <PageLoader
        description="Restoring verified account and onboarding progress."
        title="Preparing onboarding"
      />
    );
  }

  return <OnboardingRouteClientInner />;
}
