"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { signupAction, verifySignupEmail } from "@/app/(auth)/signup/actions";
import { startRouteLoading } from "@/lib/navigation-loading";
import { loadAppState, saveAppState } from "@/lib/supplyed-storage";
import { useMounted } from "@/lib/use-mounted";
import type { AppState } from "@/types/supplyed";

import { AuthFlowLoader, PublicThemeControls } from "../molecules";
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
  const [pendingPassword, setPendingPassword] = useState("");

  useEffect(() => {
    saveAppState(state);
  }, [state]);

  function formData(values: Record<string, string>) {
    const data = new FormData();
    Object.entries(values).forEach(([key, value]) => data.set(key, value));
    return data;
  }

  async function startVerification(email: string, password: string) {
    const result = await signupAction(null, formData({ email, password }));

    if (!result.ok) {
      return {
        fieldErrors: result.fieldErrors,
        message: result.message,
        ok: false as const,
      };
    }

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
    setPendingPassword(password);
    saveAppState(nextState);
    setStage("verify");
    return { ok: true as const };
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
    setPendingPassword("");
    saveAppState(nextState);
    setStage("account");
  }

  async function finishVerification(code: string) {
    const result = await verifySignupEmail(null, formData({ code, email: state.signupEmail }));

    if (!result.ok) {
      const codeError = result.fieldErrors && "code" in result.fieldErrors ? result.fieldErrors.code : undefined;
      return {
        fieldErrors: codeError ? { code: codeError } : undefined,
        message: result.message,
        ok: false as const,
      };
    }

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

    if (!pendingPassword) {
      router.push("/login");
      return { ok: true as const };
    }

    const signInResult = await signIn("credentials", {
      email: state.signupEmail,
      password: pendingPassword,
      redirect: false,
      redirectTo: "/post-auth",
    });

    if (!signInResult?.ok) {
      return {
        message: "Your email was verified. Log in again to continue onboarding.",
        ok: false as const,
      };
    }

    router.push("/post-auth");
    return { ok: true as const };
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

  function startSocialAuth(provider: "google" | "microsoft-entra-id") {
    startRouteLoading();
    void signIn(provider, { redirectTo: "/post-auth" });
  }

  if (stage === "account") {
    return (
      <>
        <SignupAccessPage
          onAccountCreated={startVerification}
          onGoogleAuth={() => startSocialAuth("google")}
          onLanding={goLanding}
          onLogin={goLogin}
          onMicrosoftAuth={() => startSocialAuth("microsoft-entra-id")}
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
  const isClient = useMounted();

  if (!isClient) {
    return (
      <AuthFlowLoader
        description="Preparing account creation and email verification."
        title="Preparing signup"
      />
    );
  }

  return <SignupRouteClientInner />;
}
