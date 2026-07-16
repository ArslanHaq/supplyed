"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

import { startRouteLoading } from "@/lib/navigation-loading";
import { buildAppHref } from "@/lib/routes";
import { loadAppState, saveAppState } from "@/lib/supplyed-storage";
import { useMounted } from "@/lib/use-mounted";
import type { AppRole, AppState } from "@/types/supplyed";

import { PageLoader, PublicThemeControls } from "../molecules";
import { OnboardingPage } from "./OnboardingPage";

type SignupRole = Extract<AppRole, "institution" | "teacher" | "individual">;

function OnboardingRouteClientInner({ accountEmail }: { accountEmail?: string }) {
  const router = useRouter();
  const [state, setState] = useState<AppState>(() => {
    const savedState = loadAppState();

    return {
      ...savedState,
      auth: "signed-in",
      signupEmail: accountEmail || savedState.signupEmail,
      signupVerified: true,
    };
  });

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
    const nextState: AppState = { ...state, auth: "signed-in" };
    setState(nextState);
    saveAppState(nextState);
    startRouteLoading();
    router.push("/");
  }

  async function logout() {
    await signOut({ redirect: false });
    const nextState: AppState = {
      ...state,
      auth: "login",
      signupVerified: false,
      page: "dashboard",
      ctx: {},
    };
    setState(nextState);
    saveAppState(nextState);
    startRouteLoading();
    router.push("/login");
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
        headerActionLabel="Logout"
        headerPrompt={state.signupEmail || accountEmail || "Account"}
        onFinish={finishOnboarding}
        onLanding={goLanding}
        onLogin={logout}
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

export function OnboardingRouteClient({ accountEmail }: { accountEmail?: string }) {
  const isClient = useMounted();

  if (!isClient) {
    return (
      <PageLoader
        description="Restoring verified account and onboarding progress."
        title="Preparing onboarding"
      />
    );
  }

  return <OnboardingRouteClientInner accountEmail={accountEmail} />;
}
