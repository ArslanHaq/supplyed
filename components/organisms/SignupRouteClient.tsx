"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { buildAppHref } from "@/lib/routes";
import { loadAppState, saveAppState } from "@/lib/supplyed-storage";
import type { AppRole, AppState } from "@/types/supplyed";

import { PublicThemeControls } from "../molecules";
import { OnboardingPage } from "./OnboardingPage";

type SignupRole = Extract<AppRole, "institution" | "teacher">;

export function SignupRouteClient({ initialRole }: { initialRole?: SignupRole }) {
  const router = useRouter();
  const [state, setState] = useState<AppState>(() => ({
    ...loadAppState(),
    ...(initialRole ? { role: initialRole } : {}),
    auth: "onboarding",
  }));

  useEffect(() => {
    saveAppState({ ...state, auth: "onboarding" });
  }, [state]);

  function setRole(role: SignupRole) {
    setState((current) => ({ ...current, role, auth: "onboarding" }));
    router.replace(`/signup?role=${role}`, { scroll: false });
  }

  function setStep(step: number) {
    setState((current) => ({ ...current, auth: "onboarding", onboardingStep: step }));
  }

  function goLanding() {
    const nextState: AppState = { ...state, auth: "landing" };
    setState(nextState);
    saveAppState(nextState);
    router.push("/");
  }

  function goLogin() {
    const nextState: AppState = { ...state, auth: "login" };
    setState(nextState);
    saveAppState(nextState);
    router.push("/login");
  }

  function finishSignup() {
    const nextState: AppState = { ...state, auth: "signed-in", page: "dashboard" };
    setState(nextState);
    saveAppState(nextState);
    router.push(buildAppHref("dashboard"));
  }

  return (
    <>
      <OnboardingPage
        onLanding={goLanding}
        onLogin={goLogin}
        role={state.role}
        setRole={setRole}
        step={state.onboardingStep}
        setStep={setStep}
        onFinish={finishSignup}
      />
      <PublicThemeControls />
    </>
  );
}
