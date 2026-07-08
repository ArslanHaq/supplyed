"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { loginAction, verifyLoginEmail } from "@/app/(auth)/login/actions";
import { startRouteLoading } from "@/lib/navigation-loading";
import { loadAppState, saveAppState } from "@/lib/supplyed-storage";
import { useMounted } from "@/lib/use-mounted";
import type { AppState } from "@/types/supplyed";

import { AuthFlowLoader, PublicThemeControls } from "../molecules";
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

  function formData(values: Record<string, string>) {
    const data = new FormData();
    Object.entries(values).forEach(([key, value]) => data.set(key, value));
    return data;
  }

  async function handleCredentialsAccepted(email: string, password: string) {
    const result = await loginAction(null, formData({ email, password }));

    if (!result.ok) {
      return {
        fieldErrors: result.fieldErrors,
        message: result.message,
        ok: false as const,
      };
    }

    const backendUser = result.data.user;
    const needsEmailVerification = backendUser.emailVerified === false || isUnverifiedAccountEmail(email);
    const challenge: LoginChallenge = needsEmailVerification ? "email-verification" : "identity-verification";

    return {
      challenge,
      ok: true as const,
    };
  }

  async function verifyEmailForLogin(email: string, code: string) {
    const result = await verifyLoginEmail(null, formData({ code, email }));

    if (!result.ok) {
      return {
        fieldErrors: result.fieldErrors,
        message: result.message,
        ok: false as const,
      };
    }

    const nextState: AppState = {
      ...state,
      auth: "login",
      signupEmail: state.signupEmail || email,
      signupVerified: true,
    };
    setState(nextState);
    saveAppState(nextState);
    return { ok: true as const };
  }

  async function finishLogin(email: string, password: string) {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      redirectTo: "/post-auth",
    });

    if (!result?.ok) {
      return {
        message: "We could not sign you in with those details.",
        ok: false as const,
      };
    }

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
      router.push("/post-auth");
      return { ok: true as const };
    }

    const nextState: AppState = { ...signedInState, page: signedInState.role === "admin" ? "admin" : "dashboard" };
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
        onCredentialsAccepted={handleCredentialsAccepted}
        onEmailVerified={verifyEmailForLogin}
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
