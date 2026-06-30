"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { startRouteLoading } from "@/lib/navigation-loading";
import { Btn, Field, Icon, Logo } from "../atoms";
import { PasswordInput } from "../atoms/PasswordInput";
import { PublicThemeControls } from "../molecules";

type ResetStage = "email" | "code" | "password" | "success";
type ResetErrors = Partial<Record<"email" | "code" | "password" | "confirmPassword", string>>;
type ResetPending = "email" | "code" | "password" | "resend" | null;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fieldClass(error?: string) {
  return `input ${error ? "border-danger bg-danger-tint" : ""}`;
}

function stageIndex(stage: ResetStage) {
  if (stage === "email") return 1;
  if (stage === "code") return 2;
  if (stage === "password") return 3;
  return 4;
}

export function ForgotPasswordRouteClient() {
  const router = useRouter();
  const [stage, setStage] = useState<ResetStage>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<ResetErrors>({});
  const [pending, setPending] = useState<ResetPending>(null);
  const codeRefs = useRef<Array<HTMLInputElement | null>>([]);
  const pendingTimerRef = useRef<number | null>(null);
  const codeValue = code.join("");
  const progress = stageIndex(stage) * 25;

  useEffect(() => {
    return () => {
      if (pendingTimerRef.current) window.clearTimeout(pendingTimerRef.current);
    };
  }, []);

  function runPending(kind: Exclude<ResetPending, null>, callback: () => void) {
    if (pendingTimerRef.current) window.clearTimeout(pendingTimerRef.current);
    setPending(kind);
    pendingTimerRef.current = window.setTimeout(() => {
      callback();
      setPending(null);
    }, 420);
  }

  function goLanding() {
    startRouteLoading();
    router.push("/");
  }

  function goLogin() {
    startRouteLoading();
    router.push("/login");
  }

  function requestReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const trimmedEmail = email.trim();
    const nextErrors: ResetErrors = {};

    if (!trimmedEmail) nextErrors.email = "Enter your email address.";
    else if (!emailPattern.test(trimmedEmail)) nextErrors.email = "Use a valid email address.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    runPending("email", () => {
      setEmail(trimmedEmail);
      setStage("code");
      window.setTimeout(() => codeRefs.current[0]?.focus(), 40);
    });
  }

  function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (codeValue.length !== 6) {
      setErrors({ code: "Enter the 6-digit reset code." });
      return;
    }

    setErrors({});
    runPending("code", () => setStage("password"));
  }

  function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const nextErrors: ResetErrors = {};

    if (password.length < 8) nextErrors.password = "Use at least 8 characters.";
    if (confirmPassword !== password) nextErrors.confirmPassword = "Passwords must match.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    runPending("password", () => setStage("success"));
  }

  function resendCode() {
    runPending("resend", () => {
      setCode(["", "", "", "", "", ""]);
      setErrors({});
      codeRefs.current[0]?.focus();
    });
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
    const nextCode = Array.from({ length: 6 }, (_, index) => pasted[index] || "");
    setCode(nextCode);
    setErrors({});
    codeRefs.current[Math.min(pasted.length, 5)]?.focus();
  }

  return (
    <>
      <div className="min-h-screen overflow-x-hidden bg-chalk lg:grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <aside className="relative flex min-h-[330px] flex-col justify-between overflow-hidden bg-[#0a0a0a] px-5 py-7 text-white sm:px-8 sm:py-10 lg:min-h-screen lg:px-14 lg:py-16">
          <div className="absolute inset-0 bg-[linear-gradient(rgb(var(--se-rgb)/0.08)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--se-rgb)/0.08)_1px,transparent_1px)] bg-[length:54px_54px]" />
          <div className="relative flex items-center justify-between gap-4">
            <Logo size={22} className="text-white" onClick={goLanding} />
            <Btn className="border-white/15 text-white hover:bg-white/10 hover:text-white" variant="ghost" size="sm" onClick={goLogin}>
              Log in
            </Btn>
          </div>

          <div className="relative my-12 max-w-[500px] lg:my-0">
            <div className="eyebrow mb-5 text-brand">Password reset</div>
            <h1 className="font-serif text-4xl leading-[1.05] sm:text-5xl lg:text-[54px]">
              Recover access
              <br />
              securely.
            </h1>
            <p className="mt-5 text-base leading-7 text-white/65">
              Request a reset code, verify your email, then set a new password before returning to your SupplyED workspace.
            </p>
          </div>

          <div className="relative text-xs text-white/40">Step {stageIndex(stage)} of 4 - Reset password</div>
        </aside>

        <section className="flex min-h-[calc(100vh-330px)] items-center justify-center px-4 py-8 sm:px-6 lg:min-h-screen lg:px-12 lg:py-16">
          <div className="w-full max-w-[500px]">
            <div className="mb-7">
              <div className="eyebrow mb-2 text-brand">Account recovery</div>
              <h2 className="font-serif text-3xl leading-tight sm:text-[38px]">
                {stage === "email" ? "Reset your password" : stage === "code" ? "Verify reset code" : stage === "password" ? "Create a new password" : "Password updated"}
              </h2>
              <p className="mt-3 text-muted">
                {stage === "email"
                  ? "Enter the email used for your SupplyED account."
                  : stage === "code"
                    ? <>Enter the 6-digit code sent to <span className="font-semibold text-ink">{email}</span>.</>
                    : stage === "password"
                      ? "Choose a new password before returning to login."
                      : "You can now log in with your new password."}
              </p>
              <div className="mt-5">
                <div className="mb-2 flex justify-between text-xs font-semibold uppercase tracking-[1px] text-muted">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="progress">
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-white p-5 shadow-(--shadow-xs) sm:p-7">
              {stage === "email" ? (
                <form noValidate onSubmit={requestReset}>
                  <Field label="Email address" htmlFor="reset-email" error={errors.email} required>
                    <input
                      aria-invalid={Boolean(errors.email)}
                      autoComplete="email"
                      className={fieldClass(errors.email)}
                      disabled={Boolean(pending)}
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
                    If this email is registered, a reset code will arrive shortly.
                  </div>

                  <Btn className="w-full" loading={pending === "email"} loadingLabel="Sending code" size="lg" type="submit" iconRight="arrow">
                    Send reset code
                  </Btn>
                </form>
              ) : null}

              {stage === "code" ? (
                <form noValidate onSubmit={verifyCode}>
                  <Field label="Reset code" error={errors.code} required>
                    <div className="grid grid-cols-6 gap-2 sm:gap-3">
                      {code.map((digit, index) => (
                        <input
                          key={index}
                          ref={(node) => {
                            codeRefs.current[index] = node;
                          }}
                          aria-label={`Reset code digit ${index + 1}`}
                          aria-invalid={Boolean(errors.code)}
                          className={fieldClass(errors.code) + " h-12 p-0 text-center text-lg font-semibold sm:h-14 sm:text-xl"}
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

                  <div className="mb-6 rounded-lg bg-chalk p-4 text-sm leading-6 text-muted">
                    Codes expire shortly. Request a new one if this reset code no longer works.
                  </div>

                  <Btn className="w-full" loading={pending === "code"} loadingLabel="Verifying code" size="lg" type="submit" iconRight="arrow">
                    Verify code
                  </Btn>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Btn className="w-full" disabled={Boolean(pending)} variant="ghost" onClick={() => setStage("email")}>
                      Back
                    </Btn>
                    <Btn
                      className="w-full"
                      loading={pending === "resend"}
                      loadingLabel="Sending"
                      variant="secondary"
                      onClick={resendCode}
                    >
                      Resend
                    </Btn>
                  </div>
                </form>
              ) : null}

              {stage === "password" ? (
                <form noValidate onSubmit={savePassword}>
                  <Field label="New password" htmlFor="new-password" error={errors.password} hint="Use at least 8 characters." required>
                    <PasswordInput
                      aria-invalid={Boolean(errors.password)}
                      autoComplete="new-password"
                      className={fieldClass(errors.password)}
                      disabled={Boolean(pending)}
                      id="new-password"
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setErrors((current) => ({ ...current, password: undefined }));
                      }}
                      placeholder="Create a new password"
                      value={password}
                    />
                  </Field>
                  <Field label="Confirm password" htmlFor="confirm-new-password" error={errors.confirmPassword} required>
                    <PasswordInput
                      aria-invalid={Boolean(errors.confirmPassword)}
                      autoComplete="new-password"
                      className={fieldClass(errors.confirmPassword)}
                      disabled={Boolean(pending)}
                      id="confirm-new-password"
                      onChange={(event) => {
                        setConfirmPassword(event.target.value);
                        setErrors((current) => ({ ...current, confirmPassword: undefined }));
                      }}
                      placeholder="Repeat the new password"
                      value={confirmPassword}
                    />
                  </Field>

                  <Btn className="w-full" loading={pending === "password"} loadingLabel="Updating password" size="lg" type="submit">
                    Update password
                  </Btn>
                </form>
              ) : null}

              {stage === "success" ? (
                <div>
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-tint text-brand">
                    <Icon name="checkCircle" size={24} />
                  </div>
                  <div className="font-serif text-2xl">Your password has been reset.</div>
                  <p className="mt-3 text-sm leading-6 text-muted">
                    Return to login and continue with the updated credentials. Any active reset links should be treated as expired after use.
                  </p>
                  <Btn className="mt-6 w-full" size="lg" onClick={goLogin} iconRight="arrow">
                    Back to login
                  </Btn>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      <PublicThemeControls />
    </>
  );
}
