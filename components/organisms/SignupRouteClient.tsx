"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { resendSignupVerification, signupAction, verifySignupEmail } from "@/app/(auth)/signup/actions";
import { startRouteLoading } from "@/lib/navigation-loading";
import { loadAppState, resetAuthFlowState, saveAppState } from "@/lib/supplyed-storage";
import { useMounted } from "@/lib/use-mounted";
import type { AppState } from "@/types/supplyed";

import { AuthFlowLoader, PublicThemeControls } from "../molecules";
import { SignupAccessPage } from "./SignupAccessPage";
import { SignupVerifyPage } from "./SignupVerifyPage";

type SignupStage = "account" | "verify";

function readCooldownUntil(expiresInMinutes: unknown) {
  return typeof expiresInMinutes === "number" && Number.isFinite(expiresInMinutes) && expiresInMinutes > 0
    ? Date.now() + expiresInMinutes * 60 * 1000
    : undefined;
}

function SignupRouteClientInner() {
  const router = useRouter();
  const [state, setState] = useState<AppState>(() => resetAuthFlowState(loadAppState(), "onboarding"));
  const [stage, setStage] = useState<SignupStage>("account");
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

  async function startVerification(email: string, password: string) {
    const result = await signupAction(null, formData({ email, password }));

    if (!result.ok) {
      return {
        fieldErrors: result.fieldErrors,
        message: result.message,
        ok: false as const,
      };
    }

    const signupEmail = result.data.email || email;
    const passwordNotice = result.data.passwordUpdated === false ? result.message : undefined;
    const nextState: AppState = {
      ...state,
      auth: "onboarding",
      signupEmail,
      signupVerified: false,
      roleSelected: false,
      onboardingComplete: false,
      applicationStatus: "none",
      onboardingStep: 1,
    };
    setState(nextState);
    saveAppState(nextState);
    setVerificationToken(result.data.otpToken);
    setVerificationNotice(passwordNotice);
    setResendAvailableAt(readCooldownUntil(result.data.expiresInMinutes));
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
    saveAppState(nextState);
    setVerificationToken(undefined);
    setVerificationNotice(undefined);
    setResendAvailableAt(undefined);
    setStage("account");
  }

  async function finishVerification(code: string) {
    const verificationResult = await verifySignupEmail(
      null,
      formData({ code, email: state.signupEmail, otpToken: verificationToken ?? "" }),
    );

    if (!verificationResult.ok) {
      return {
        message: verificationResult.message,
        ok: false as const,
      };
    }

    const ticket =
      verificationResult.data && typeof verificationResult.data === "object" && "ticket" in verificationResult.data
        ? String(verificationResult.data.ticket ?? "")
        : "";

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
    const result = await resendSignupVerification(null, formData({ email: state.signupEmail }));

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

  function goLanding() {
    const nextState: AppState = { ...state, auth: "landing" };
    setState(nextState);
    saveAppState(nextState);
    startRouteLoading();
    router.push("/");
  }

  function goLogin() {
    const nextState = resetAuthFlowState(state, "login");
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
          notice={verificationNotice}
          onBack={backToAccount}
          onLanding={goLanding}
          onLogin={goLogin}
          onResend={resendVerification}
          onVerified={finishVerification}
          resendAvailableAt={resendAvailableAt}
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
