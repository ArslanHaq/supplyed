"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { loginAction, resendLoginVerification, verifyLoginEmail } from "@/app/(auth)/login/actions";
import { startRouteLoading } from "@/lib/navigation-loading";
import { loadAppState, resetAuthFlowState, saveAppState } from "@/lib/supplyed-storage";
import { useMounted } from "@/lib/use-mounted";
import type { AppState } from "@/types/supplyed";

import { AuthFlowLoader, PublicThemeControls } from "../molecules";
import { LoginPage } from "./LoginPage";
import { SignupVerifyPage } from "./SignupVerifyPage";

type LoginStage = "login" | "verify";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readCooldownUntil(expiresInMinutes: unknown) {
  return typeof expiresInMinutes === "number" && Number.isFinite(expiresInMinutes) && expiresInMinutes > 0
    ? Date.now() + expiresInMinutes * 60 * 1000
    : undefined;
}

function isVerificationChallenge(value: unknown): value is {
  email: string;
  emailVerified: false;
  expiresInMinutes?: number;
  otpToken?: string;
} {
  return isRecord(value) && value.emailVerified === false && Boolean(readString(value.email));
}

function LoginRouteClientInner() {
  const router = useRouter();
  const [state, setState] = useState<AppState>(() => resetAuthFlowState(loadAppState(), "login"));
  const [stage, setStage] = useState<LoginStage>("login");
  const [verificationEmail, setVerificationEmail] = useState(state.signupEmail);
  const [verificationNotice, setVerificationNotice] = useState<string>();
  const [verificationToken, setVerificationToken] = useState<string>();
  const [resendAvailableAt, setResendAvailableAt] = useState<number>();

  useEffect(() => {
    saveAppState(state);
  }, [state]);

  function formData(values: Record<string, string>) {
    const data = new FormData();
    Object.entries(values).forEach(([key, value]) => data.set(key, value));
    return data;
  }

  function startEmailVerification(
    email: string,
    otpToken: string | undefined,
    message?: string,
    expiresInMinutes?: number,
  ) {
    const nextState: AppState = {
      ...state,
      auth: "login",
      signupEmail: email,
      signupVerified: false,
      roleSelected: false,
      onboardingComplete: false,
      applicationStatus: "none",
      onboardingStep: 1,
    };

    setState(nextState);
    saveAppState(nextState);
    setVerificationEmail(email);
    setVerificationNotice(message);
    setVerificationToken(otpToken);
    setResendAvailableAt(readCooldownUntil(expiresInMinutes));
    setStage("verify");
  }

  function goLanding() {
    const nextState: AppState = { ...state, auth: "landing" };
    setState(nextState);
    saveAppState(nextState);
    startRouteLoading();
    router.push("/");
  }

  function goSignup() {
    const nextState = resetAuthFlowState(state, "onboarding");
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
    const loginResult = await loginAction(null, formData({ email, password }));

    if (!loginResult.ok) {
      return {
        fieldErrors: loginResult.fieldErrors,
        message: loginResult.message,
        ok: false as const,
      };
    }

    if (isVerificationChallenge(loginResult.data)) {
      startEmailVerification(
        loginResult.data.email,
        loginResult.data.otpToken,
        loginResult.message,
        loginResult.data.expiresInMinutes,
      );
      return { ok: true as const };
    }

    const ticket = isRecord(loginResult.data) ? readString(loginResult.data.ticket) : undefined;
    if (!ticket) {
      return {
        message: "We could not create your session. Try signing in again.",
        ok: false as const,
      };
    }

    const result = await signIn("credentials", {
      flow: "verified-email-session",
      redirect: false,
      redirectTo: "/post-auth",
      ticket,
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

  function backToLogin() {
    const nextState: AppState = {
      ...state,
      auth: "login",
    };
    setState(nextState);
    saveAppState(nextState);
    setStage("login");
    setVerificationNotice(undefined);
    setVerificationToken(undefined);
    setResendAvailableAt(undefined);
  }

  async function finishVerification(code: string) {
    const verificationResult = await verifyLoginEmail(
      null,
      formData({ code, email: verificationEmail, otpToken: verificationToken ?? "" }),
    );

    if (!verificationResult.ok) {
      return {
        message: verificationResult.message,
        ok: false as const,
      };
    }

    const ticket = isRecord(verificationResult.data) ? readString(verificationResult.data.ticket) : undefined;
    if (!ticket) {
      return {
        message: "Email verified, but we could not create your session. Log in again to continue.",
        ok: false as const,
      };
    }

    const signInResult = await signIn("credentials", {
      flow: "verified-email-session",
      redirect: false,
      redirectTo: "/post-auth",
      ticket,
    });

    if (!signInResult?.ok) {
      return {
        message: "Email verified, but we could not create your session. Log in again to continue.",
        ok: false as const,
      };
    }

    const nextState: AppState = {
      ...state,
      auth: "signed-in",
      signupEmail: verificationEmail,
      signupVerified: true,
      roleSelected: false,
      onboardingComplete: false,
      applicationStatus: "none",
      onboardingStep: 1,
    };
    setState(nextState);
    saveAppState(nextState);
    startRouteLoading();
    router.push("/post-auth");
    return { ok: true as const };
  }

  async function resendVerification() {
    const result = await resendLoginVerification(null, formData({ email: verificationEmail }));

    if (!result.ok) {
      return {
        message: result.message,
        ok: false as const,
      };
    }

    if (!result.data.emailVerified) {
      setVerificationToken(result.data.otpToken);
      setVerificationNotice(result.message);
      setResendAvailableAt(readCooldownUntil(result.data.expiresInMinutes));
    }

    return { ok: true as const };
  }

  function startSocialAuth(provider: "google" | "microsoft-entra-id") {
    startRouteLoading();
    void signIn(provider, { redirectTo: "/post-auth" });
  }

  if (stage === "verify") {
    return (
      <>
        <SignupVerifyPage
          email={verificationEmail}
          notice={verificationNotice}
          onBack={backToLogin}
          onLanding={goLanding}
          onLogin={backToLogin}
          onResend={resendVerification}
          onVerified={finishVerification}
          resendAvailableAt={resendAvailableAt}
        />
        <PublicThemeControls />
      </>
    );
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
