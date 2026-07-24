"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { resendSignupVerification, signupAction, verifySignupEmail } from "@/app/(auth)/signup/actions";
import { readUnknownAuthErrorMessage } from "@/features/auth/error-messages";
import { startRouteLoading } from "@/lib/navigation-loading";
import { useAuthToasts } from "@/lib/use-auth-toasts";
import { useMounted } from "@/lib/use-mounted";
import type { SocialAuthAvailability } from "@/types/supplyed";

import { AuthFlowLoader, PublicThemeControls, ToastStack } from "../molecules";
import { SignupAccessPage } from "./SignupAccessPage";
import { SignupVerifyPage } from "./SignupVerifyPage";

type SignupStage = "account" | "verify";

function readCooldownUntil(expiresInMinutes: unknown) {
  return typeof expiresInMinutes === "number" && Number.isFinite(expiresInMinutes) && expiresInMinutes > 0
    ? Date.now() + expiresInMinutes * 60 * 1000
    : undefined;
}

function socialUnavailableMessage(provider: "google" | "microsoft-entra-id") {
  return provider === "google"
    ? "Google sign-in is not configured. Add AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET, then restart the app."
    : "Microsoft sign-in is not configured. Add AUTH_MICROSOFT_ENTRA_ID_ID and AUTH_MICROSOFT_ENTRA_ID_SECRET, then restart the app.";
}

function isSocialProviderAvailable(provider: "google" | "microsoft-entra-id", socialAuth: SocialAuthAvailability) {
  return provider === "google" ? socialAuth.google : socialAuth.microsoft;
}

function SignupRouteClientInner({ initialError, socialAuth }: { initialError?: string; socialAuth: SocialAuthAvailability }) {
  const router = useRouter();
  const [stage, setStage] = useState<SignupStage>("account");
  const [signupEmail, setSignupEmail] = useState("");
  const [verificationNotice, setVerificationNotice] = useState<string>();
  const [verificationToken, setVerificationToken] = useState<string>();
  const [resendAvailableAt, setResendAvailableAt] = useState<number>();
  const { authToasts, dismissAuthToast, showAuthError } = useAuthToasts(initialError);

  function formData(values: Record<string, string>) {
    const data = new FormData();
    Object.entries(values).forEach(([key, value]) => data.set(key, value));
    return data;
  }

  async function startVerification(email: string, password: string) {
    let result: Awaited<ReturnType<typeof signupAction>>;

    try {
      result = await signupAction(null, formData({ email, password }));
    } catch (error) {
      const message = readUnknownAuthErrorMessage(error, "We could not create this account.");
      showAuthError(message);
      return { message, ok: false as const };
    }

    if (!result.ok) {
      showAuthError(result.message);
      return {
        fieldErrors: result.fieldErrors,
        message: result.message,
        ok: false as const,
      };
    }

    const signupEmail = result.data.email || email;
    const passwordNotice = result.data.passwordUpdated === false ? result.message : undefined;
    setSignupEmail(signupEmail);
    setVerificationToken(result.data.otpToken);
    setVerificationNotice(passwordNotice);
    setResendAvailableAt(readCooldownUntil(result.data.expiresInMinutes));
    setStage("verify");
    return { ok: true as const };
  }

  function backToAccount() {
    setSignupEmail("");
    setVerificationToken(undefined);
    setVerificationNotice(undefined);
    setResendAvailableAt(undefined);
    setStage("account");
  }

  async function finishVerification(code: string) {
    let verificationResult: Awaited<ReturnType<typeof verifySignupEmail>>;

    try {
      verificationResult = await verifySignupEmail(
        null,
        formData({ code, email: signupEmail, otpToken: verificationToken ?? "" }),
      );
    } catch (error) {
      const message = readUnknownAuthErrorMessage(error, "We could not verify that code.");
      showAuthError(message);
      return { message, ok: false as const };
    }

    if (!verificationResult.ok) {
      showAuthError(verificationResult.message);
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
      const message = "Email verified, but we could not create your session. Log in again to continue.";
      showAuthError(message);
      return {
        message,
        ok: false as const,
      };
    }

    let signInResult: Awaited<ReturnType<typeof signIn>>;

    try {
      signInResult = await signIn("credentials", {
        flow: "verified-email-session",
        redirect: false,
        redirectTo: "/post-auth",
        ticket,
      });
    } catch (error) {
      const message = readUnknownAuthErrorMessage(error, "Email verified, but we could not create your session.");
      showAuthError(message);
      return { message, ok: false as const };
    }

    if (!signInResult?.ok) {
      const message = signInResult?.error || "Email verified, but we could not create your session. Log in again to continue.";
      showAuthError(message);
      return {
        message,
        ok: false as const,
      };
    }

    startRouteLoading();
    router.push("/post-auth");
    return { ok: true as const };
  }

  async function resendVerification() {
    let result: Awaited<ReturnType<typeof resendSignupVerification>>;

    try {
      result = await resendSignupVerification(null, formData({ email: signupEmail }));
    } catch (error) {
      const message = readUnknownAuthErrorMessage(error, "We could not resend the verification code.");
      showAuthError(message);
      return { message, ok: false as const };
    }

    if (!result.ok) {
      showAuthError(result.message);
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
    startRouteLoading();
    router.push("/");
  }

  function goLogin() {
    startRouteLoading();
    router.push("/login");
  }

  function startSocialAuth(provider: "google" | "microsoft-entra-id") {
    if (!isSocialProviderAvailable(provider, socialAuth)) {
      showAuthError(socialUnavailableMessage(provider));
      return;
    }

    startRouteLoading();
    void signIn(provider, { redirectTo: "/post-auth?authSource=signup" }).catch((error) => {
      showAuthError(readUnknownAuthErrorMessage(error, "Social sign-up could not start."));
    });
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
          socialAuth={socialAuth}
        />
        <PublicThemeControls />
        <ToastStack autoCloseMs={7000} onDismiss={dismissAuthToast} toasts={authToasts} />
      </>
    );
  }

  if (stage === "verify") {
    return (
      <>
        <SignupVerifyPage
          email={signupEmail}
          notice={verificationNotice}
          onBack={backToAccount}
          onLanding={goLanding}
          onLogin={goLogin}
          onResend={resendVerification}
          onVerified={finishVerification}
          resendAvailableAt={resendAvailableAt}
        />
        <PublicThemeControls />
        <ToastStack autoCloseMs={7000} onDismiss={dismissAuthToast} toasts={authToasts} />
      </>
    );
  }

  return null;
}

export function SignupRouteClient({ initialError, socialAuth }: { initialError?: string; socialAuth: SocialAuthAvailability }) {
  const isClient = useMounted();

  if (!isClient) {
    return (
      <AuthFlowLoader
        description="Preparing account creation and email verification."
        title="Preparing signup"
      />
    );
  }

  return <SignupRouteClientInner initialError={initialError} socialAuth={socialAuth} />;
}
