"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { buildAppHref } from "@/lib/routes";
import { loadAppState, saveAppState } from "@/lib/supplyed-storage";
import type { AppPage, AppRole, AppState } from "@/types/supplyed";

import { PublicThemeControls } from "../molecules";
import { LoginPage } from "./LoginPage";

type LoginRole = Extract<AppRole, "institution" | "teacher">;

function signupHref(role?: LoginRole) {
  return role ? `/signup?role=${role}` : "/signup";
}

export function LoginRouteClient() {
  const router = useRouter();
  const [state, setState] = useState<AppState>(() => ({ ...loadAppState(), auth: "login" }));

  useEffect(() => {
    saveAppState({ ...state, auth: "login" });
  }, [state]);

  function setRole(role: LoginRole) {
    setState((current) => ({ ...current, role, auth: "login" }));
  }

  function goLanding() {
    const nextState: AppState = { ...state, auth: "landing" };
    setState(nextState);
    saveAppState(nextState);
    router.push("/");
  }

  function goSignup(role?: LoginRole) {
    const nextState: AppState = {
      ...state,
      ...(role ? { role } : {}),
      auth: "onboarding",
      onboardingStep: 1,
    };
    setState(nextState);
    saveAppState(nextState);
    router.push(signupHref(role));
  }

  function finishLogin() {
    const nextPage: AppPage = state.role === "admin" ? "admin" : "dashboard";
    const nextState: AppState = { ...state, auth: "signed-in", page: nextPage };
    setState(nextState);
    saveAppState(nextState);
    router.push(buildAppHref(nextPage));
  }

  return (
    <>
      <LoginPage
        onLanding={goLanding}
        role={state.role}
        setRole={setRole}
        onLogin={finishLogin}
        onSwitchSignup={goSignup}
      />
      <PublicThemeControls />
    </>
  );
}
