"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { confirmPasswordResetAction, requestPasswordResetAction } from "@/app/(auth)/forgot-password/actions";
import { readUnknownAuthErrorMessage } from "@/features/auth/error-messages";
import { passwordRequirementsMessage, validatePassword } from "@/features/auth/schemas";
import {
  formatCodeResendCountdown,
  nextCodeResendAvailableAt,
  secondsUntilCodeResend,
} from "@/lib/code-resend-cooldown";
import { startRouteLoading } from "@/lib/navigation-loading";
import { useAuthToasts } from "@/lib/use-auth-toasts";

import { Btn, Field, Icon, Logo } from "../atoms";
import { PasswordInput } from "../atoms/PasswordInput";
import {
  ConfirmPasswordMismatch,
  hasConfirmPasswordMismatch,
  PasswordRequirementHint,
  passwordMismatchMessage,
  PublicThemeControls,
  ToastStack,
} from "../molecules";

type ResetStage = "request" | "reset" | "success";
type ResetPending = "request" | "confirm" | "resend" | null;
type ResetErrors = Partial<Record<"code" | "confirmPassword" | "email" | "password", string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emptyCode = ["", "", "", "", "", ""];

function fieldClass(error?: string) {
  return `input ${error ? "border-danger bg-danger-tint" : ""}`;
}

function formData(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

export function ForgotPasswordRouteClient() {
  const router = useRouter();
  const [stage, setStage] = useState<ResetStage>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(emptyCode);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<ResetErrors>({});
  const [pending, setPending] = useState<ResetPending>(null);
  const [message, setMessage] = useState("Enter your email and we will send a reset code if the account exists.");
  const [resetToken, setResetToken] = useState<string>();
  const [resendAvailableAt, setResendAvailableAt] = useState<number>();
  const [resendRemainingSeconds, setResendRemainingSeconds] = useState(0);
  const codeRefs = useRef<Array<HTMLInputElement | null>>([]);
  const { authToasts, dismissAuthToast, showAuthError } = useAuthToasts();
  const codeValue = code.join("");
  const resendLocked = resendRemainingSeconds > 0;

  useEffect(() => {
    function syncResendTimer() {
      if (!resendAvailableAt) {
        setResendRemainingSeconds(0);
        return;
      }

      setResendRemainingSeconds(secondsUntilCodeResend(resendAvailableAt));
    }

    syncResendTimer();
    if (!resendAvailableAt) return undefined;

    const timer = window.setInterval(syncResendTimer, 1000);
    return () => window.clearInterval(timer);
  }, [resendAvailableAt]);

  function goLanding() {
    startRouteLoading();
    router.push("/");
  }

  function goLogin() {
    startRouteLoading();
    router.push("/login");
  }

  function resetToEmail() {
    setStage("request");
    setCode(emptyCode);
    setPassword("");
    setConfirmPassword("");
    setErrors({});
    setPending(null);
    setResetToken(undefined);
    setResendAvailableAt(undefined);
  }

  function handleCodeChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setCode((current) => current.map((item, itemIndex) => (itemIndex === index ? digit : item)));
    setErrors((current) => ({ ...current, code: undefined }));

    if (digit && index < code.length - 1) {
      codeRefs.current[index + 1]?.focus();
    }
  }

  function handleCodeKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  }

  function handleCodePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    event.preventDefault();
    setCode(Array.from({ length: 6 }, (_, index) => pasted[index] || ""));
    codeRefs.current[Math.min(pasted.length, 5)]?.focus();
    setErrors((current) => ({ ...current, code: undefined }));
  }

  async function requestReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const trimmedEmail = email.trim().toLowerCase();
    const nextErrors: ResetErrors = {};

    if (!trimmedEmail) nextErrors.email = "Enter your email address.";
    else if (!emailPattern.test(trimmedEmail)) nextErrors.email = "Use a valid email address.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setPending("request");

    try {
      const result = await requestPasswordResetAction(null, formData({ email: trimmedEmail }));

      if (!result.ok) {
        setErrors(result.fieldErrors ?? { email: result.message });
        showAuthError(result.message);
        return;
      }

      if (!result.data.otpToken) {
        const nextMessage = "We could not start password reset. Request a new code and try again.";
        setErrors({ email: nextMessage });
        showAuthError(nextMessage);
        return;
      }

      setEmail(trimmedEmail);
      setMessage(result.message ?? "Check your email for a 6-digit reset code. If this address is registered, it should arrive shortly.");
      setResetToken(result.data.otpToken);
      setResendAvailableAt(nextCodeResendAvailableAt());
      setCode(emptyCode);
      setPassword("");
      setConfirmPassword("");
      setErrors({});
      setStage("reset");
      window.setTimeout(() => codeRefs.current[0]?.focus(), 40);
    } catch (error) {
      showAuthError(readUnknownAuthErrorMessage(error, "We could not request a password reset."));
    } finally {
      setPending(null);
    }
  }

  async function resendCode() {
    if (pending || resendLocked) return;

    setPending("resend");

    try {
      const result = await requestPasswordResetAction(null, formData({ email }));

      if (!result.ok) {
        showAuthError(result.message);
        return;
      }

      if (!result.data.otpToken) {
        showAuthError("We could not send a new reset code. Try again.");
        return;
      }

      setMessage(result.message ?? "We sent a fresh reset code if this email is linked to SupplyED.");
      setResetToken(result.data.otpToken);
      setResendAvailableAt(nextCodeResendAvailableAt());
      setCode(emptyCode);
      setErrors({});
      window.setTimeout(() => codeRefs.current[0]?.focus(), 40);
    } catch (error) {
      showAuthError(readUnknownAuthErrorMessage(error, "We could not resend the reset code."));
    } finally {
      setPending(null);
    }
  }

  async function confirmReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const nextErrors: ResetErrors = {};

    if (codeValue.length !== 6) nextErrors.code = "Enter the 6-digit reset code.";
    if (!password) nextErrors.password = "Create a password.";
    else if (!validatePassword(password)) nextErrors.password = passwordRequirementsMessage;
    if (!confirmPassword) nextErrors.confirmPassword = "Confirm your password.";
    else if (confirmPassword !== password) nextErrors.confirmPassword = passwordMismatchMessage;

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setPending("confirm");

    try {
      const result = await confirmPasswordResetAction(
        null,
        formData({ code: codeValue, otpToken: resetToken ?? "", password }),
      );

      if (!result.ok) {
        setErrors(result.fieldErrors ?? { code: result.message });
        showAuthError(result.message);
        return;
      }

      setMessage(result.message ?? "Password reset successfully. Log in with your new password.");
      setStage("success");
      setPassword("");
      setConfirmPassword("");
      setCode(emptyCode);
      setResetToken(undefined);
      setResendAvailableAt(undefined);
    } catch (error) {
      showAuthError(readUnknownAuthErrorMessage(error, "We could not reset your password."));
    } finally {
      setPending(null);
    }
  }

  const confirmPasswordMismatch = hasConfirmPasswordMismatch(password, confirmPassword);
  const passwordError = errors.password === passwordRequirementsMessage ? undefined : errors.password;
  const confirmPasswordError =
    confirmPasswordMismatch || errors.confirmPassword === passwordMismatchMessage ? undefined : errors.confirmPassword;

  return (
    <>
      <div className="auth-shell">
        <aside className="auth-aside">
          <div className="auth-aside-rule" aria-hidden="true" />
          <div className="relative flex items-center justify-between gap-4">
            <Logo size={22} className="text-white" onClick={goLanding} />
            <Btn className="border-white/15 text-white hover:bg-white/10 hover:text-white" variant="ghost" size="sm" onClick={goLogin}>
              Log in
            </Btn>
          </div>

          <div className="auth-story">
            <div className="eyebrow">Password reset</div>
            <h1 className="font-heading text-white">
              Recover access
              <br />{" "}
              securely.
            </h1>
            <p className="auth-story-description">
              SupplyED sends a short-lived reset code to your email. Enter the code here to choose a new password.
            </p>
          </div>

          <div className="auth-aside-footer">Account recovery</div>
        </aside>

        <section className="auth-main">
          <div className="auth-main-inner">
            <div className="auth-security-badge"><Icon name="shield" size={18} /> Account recovery</div>
            <div className="auth-form-heading">
              <div className="eyebrow mb-2 text-brand">Account recovery</div>
              <h2 className="font-heading">
                {stage === "success" ? "Password updated" : stage === "reset" ? "Enter reset code" : "Reset your password"}
              </h2>
              <p className="mt-3 text-muted">
                {stage === "success"
                  ? "Your password has been changed."
                  : stage === "reset"
                    ? "Use the code from your email and create a new password."
                    : "Enter the email used for your SupplyED account."}
              </p>
            </div>

            <div className="auth-form">
              {stage === "success" ? (
                <div>
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-tint text-brand">
                    <Icon name="checkCircle" size={24} />
                  </div>
                  <div className="font-heading text-2xl">You can log in now.</div>
                  <p className="mt-3 text-sm leading-6 text-muted">{message}</p>
                  <Btn className="mt-6 w-full" size="lg" onClick={goLogin} iconRight="arrow">
                    Back to login
                  </Btn>
                </div>
              ) : stage === "reset" ? (
                <form method="post" noValidate onSubmit={confirmReset}>
                  <div className="mb-5 rounded-lg border border-brand/20 bg-brand-tint p-4 text-sm leading-6 text-brand-dark">
                    <div className="font-semibold text-brand-dark">Check your email</div>
                    <p className="mt-1">{message}</p>
                    <p className="mt-2">
                      Enter the code below to create a new password for <span className="font-semibold">{email}</span>.
                    </p>
                  </div>

                  <Field label="Reset code" error={errors.code} required>
                    <div className="auth-code-grid">
                      {code.map((digit, index) => (
                        <input
                          key={index}
                          ref={(node) => {
                            codeRefs.current[index] = node;
                          }}
                          aria-label={`Reset code digit ${index + 1}`}
                          className="input auth-code-input"
                          disabled={Boolean(pending)}
                          inputMode="numeric"
                          maxLength={1}
                          onChange={(event) => handleCodeChange(index, event.target.value)}
                          onKeyDown={(event) => handleCodeKeyDown(index, event)}
                          onPaste={handleCodePaste}
                          value={digit}
                        />
                      ))}
                    </div>
                  </Field>

                  <Field label="New password" htmlFor="reset-new-password" error={passwordError} required>
                    <PasswordInput
                      autoComplete="new-password"
                      className={fieldClass(passwordError)}
                      disabled={Boolean(pending)}
                      id="reset-new-password"
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setErrors((current) => ({ ...current, password: undefined }));
                      }}
                      placeholder="Create a new password"
                      value={password}
                    />
                    <PasswordRequirementHint password={password} />
                  </Field>

                  <Field label="Confirm password" htmlFor="reset-confirm-password" error={confirmPasswordError} required>
                    <PasswordInput
                      autoComplete="new-password"
                      className={fieldClass(confirmPasswordError)}
                      disabled={Boolean(pending)}
                      id="reset-confirm-password"
                      onChange={(event) => {
                        setConfirmPassword(event.target.value);
                        setErrors((current) => ({ ...current, confirmPassword: undefined }));
                      }}
                      placeholder="Repeat your new password"
                      value={confirmPassword}
                    />
                    <ConfirmPasswordMismatch confirmPassword={confirmPassword} password={password} />
                  </Field>

                  <Btn className="w-full" loading={pending === "confirm"} loadingLabel="Resetting password" size="lg" type="submit" iconRight="arrow">
                    Reset password
                  </Btn>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Btn className="w-full" disabled={Boolean(pending)} variant="ghost" onClick={resetToEmail}>
                      Change email
                    </Btn>
                    <Btn
                      className="w-full"
                      disabled={Boolean(pending) || resendLocked}
                      loading={pending === "resend"}
                      loadingLabel="Sending"
                      variant="secondary"
                      onClick={resendCode}
                    >
                      {resendLocked ? `Resend in ${formatCodeResendCountdown(resendRemainingSeconds)}` : "Send new code"}
                    </Btn>
                  </div>
                </form>
              ) : (
                <form method="post" noValidate onSubmit={requestReset}>
                  <Field label="Email address" htmlFor="reset-email" error={errors.email} required>
                    <input
                      aria-invalid={Boolean(errors.email)}
                      autoComplete="email"
                      className={fieldClass(errors.email)}
                      disabled={pending === "request"}
                      id="reset-email"
                      inputMode="email"
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setErrors((current) => ({ ...current, email: undefined }));
                      }}
                      placeholder="name@example.com"
                      type="email"
                      value={email}
                    />
                  </Field>

                  <div className="mb-6 rounded-lg bg-brand-tint p-4 text-sm leading-6 text-brand-dark">
                    For privacy, SupplyED shows the same confirmation whether or not the email is registered.
                  </div>

                  <Btn className="w-full" loading={pending === "request"} loadingLabel="Sending reset code" size="lg" type="submit" iconRight="arrow">
                    Send reset code
                  </Btn>
                </form>
              )}
            </div>
          </div>
        </section>
      </div>

      <PublicThemeControls />
      <ToastStack autoCloseMs={7000} onDismiss={dismissAuthToast} toasts={authToasts} />
    </>
  );
}
