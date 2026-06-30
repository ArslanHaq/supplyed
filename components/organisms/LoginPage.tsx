import { useRef, useState } from "react";

import { Btn, Checkbox, Field, Logo } from "../atoms";
import { PasswordInput } from "../atoms/PasswordInput";

type LoginErrors = Partial<Record<"email" | "password" | "code", string>>;
type LoginStep = "credentials" | "email-verification" | "identity-verification";
type LoginChallenge = "email-verification" | "identity-verification";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage({
  onCredentialsAccepted,
  onEmailVerified,
  onLogin,
  onLanding,
  onForgotPassword,
  onSwitchSignup,
}: {
  onCredentialsAccepted: (email: string) => LoginChallenge;
  onEmailVerified: (email: string) => void;
  onLogin: (email: string) => void;
  onLanding: () => void;
  onForgotPassword: () => void;
  onSwitchSignup: () => void;
}) {
  const [step, setStep] = useState<LoginStep>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [errors, setErrors] = useState<LoginErrors>({});
  const codeRefs = useRef<Array<HTMLInputElement | null>>([]);
  const codeValue = code.join("");

  function validateCredentials() {
    const nextErrors: LoginErrors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) nextErrors.email = "Enter your email address.";
    else if (!emailPattern.test(trimmedEmail)) nextErrors.email = "Use a valid email address.";

    if (!password) nextErrors.password = "Enter your password.";
    else if (password.length < 8) nextErrors.password = "Password must be at least 8 characters.";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function validateCode() {
    if (codeValue.length !== 6) {
      setErrors({ code: "Enter the 6-digit verification code." });
      return false;
    }

    setErrors({});
    return true;
  }

  function handleCredentialSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateCredentials()) return;
    setStep(onCredentialsAccepted(email.trim()));
    setCode(["", "", "", "", "", ""]);
    setErrors({});
    window.setTimeout(() => codeRefs.current[0]?.focus(), 40);
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
    codeRefs.current[Math.min(pasted.length, 5)]?.focus();
  }

  function handleChallengeSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateCode()) return;

    if (step === "email-verification") {
      onEmailVerified(email.trim());
      setCode(["", "", "", "", "", ""]);
      setErrors({});
      setStep("identity-verification");
      window.setTimeout(() => codeRefs.current[0]?.focus(), 40);
      return;
    }

    onLogin(email.trim());
  }

  const isCredentialsStep = step === "credentials";
  const isEmailVerificationStep = step === "email-verification";

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--chalk)] lg:grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <aside className="relative flex min-h-[340px] flex-col justify-between overflow-hidden bg-[#0a0a0a] px-5 py-7 text-white sm:px-8 sm:py-10 lg:min-h-screen lg:px-14 lg:py-16">
        <div className="absolute inset-0 bg-[linear-gradient(rgb(var(--se-rgb)/0.08)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--se-rgb)/0.08)_1px,transparent_1px)] bg-[length:54px_54px]" />
        <div className="relative flex items-center justify-between gap-4">
          <Logo size={22} className="text-white" onClick={onLanding} />
          <Btn
            className="border-white/15 text-white hover:bg-white/10 hover:text-white"
            variant="ghost"
            size="sm"
            onClick={onSwitchSignup}
          >
            Sign up
          </Btn>
        </div>

        <div className="relative my-12 max-w-[470px] lg:my-0">
          <div className="eyebrow mb-5 text-[var(--se)]">Welcome back</div>
          <h1 className="font-serif text-4xl leading-[1.05] sm:text-5xl lg:text-[54px]">
            Pick up where
            <br />
            <em className="text-[var(--se)]">staffing continues.</em>
          </h1>
          <p className="mt-5 text-base leading-7 text-white/65">
            Sign in once. SupplyED then checks email verification, two-factor requirements, role selection, and application status before opening the right workspace.
          </p>
        </div>

        <div className="relative text-xs text-white/40">© 2026 SupplyED</div>
      </aside>

      <section className="flex min-h-[calc(100vh-340px)] items-center justify-center px-4 py-8 sm:px-6 lg:min-h-screen lg:px-12 lg:py-16">
        <div className="w-full max-w-[460px]">
          <div className="mb-7">
            <div className="eyebrow mb-2 text-[var(--se)]">Secure sign in</div>
            <h2 className="font-serif text-3xl leading-tight sm:text-[38px]">
              {isCredentialsStep ? "Log in to SupplyED" : isEmailVerificationStep ? "Verify your email" : "Verify your identity"}
            </h2>
            <p className="mt-3 text-[var(--muted)]">
              {isCredentialsStep ? (
                <>
                  New to SupplyED?{" "}
                  <button className="font-semibold text-[var(--se)]" onClick={onSwitchSignup} type="button">
                    Create an account
                  </button>
                </>
              ) : isEmailVerificationStep ? (
                <>Confirm <span className="font-semibold text-[var(--ink)]">{email.trim()}</span> before we continue your sign in.</>
              ) : (
                <>Enter the 6-digit code sent to <span className="font-semibold text-[var(--ink)]">{email.trim()}</span>.</>
              )}
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-xs)] sm:p-7">
            {isCredentialsStep ? (
              <form noValidate onSubmit={handleCredentialSubmit}>
                <Field label="Email address" htmlFor="login-email" error={errors.email} required>
                  <input
                    aria-invalid={Boolean(errors.email)}
                    autoComplete="email"
                    className="input"
                    id="login-email"
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

                <Field label="Password" htmlFor="login-password" error={errors.password} required>
                  <PasswordInput
                    aria-invalid={Boolean(errors.password)}
                    autoComplete="current-password"
                    className="input"
                    id="login-password"
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setErrors((current) => ({ ...current, password: undefined }));
                    }}
                    placeholder="Enter your password"
                    value={password}
                  />
                </Field>

                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                  <Checkbox checked={remember} onChange={setRemember} label="Remember this device" />
                  <button className="text-sm font-semibold text-[var(--se)]" onClick={onForgotPassword} type="button">
                    Forgot password?
                  </button>
                </div>

                <Btn className="w-full" size="lg" type="submit" iconRight="arrow">
                  Continue securely
                </Btn>
              </form>
            ) : (
              <form noValidate onSubmit={handleChallengeSubmit}>
                <Field label={isEmailVerificationStep ? "Email verification code" : "Verification code"} error={errors.code} required>
                  <div className="grid grid-cols-6 gap-2 sm:gap-3">
                    {code.map((digit, index) => (
                      <input
                        key={index}
                        ref={(node) => {
                          codeRefs.current[index] = node;
                        }}
                        aria-label={`Verification digit ${index + 1}`}
                        className="input h-12 p-0 text-center text-lg font-semibold sm:h-14 sm:text-xl"
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

                <div className="mb-6 rounded-lg bg-[var(--se-tint)] p-4 text-sm leading-6 text-[var(--se-dark)]">
                  {isEmailVerificationStep
                    ? "Your email is not verified yet. Enter the email verification code first, then we will continue the sign in."
                    : "Keep this browser open while you check your email. Codes expire after 10 minutes."}
                </div>

                <Btn className="w-full" size="lg" type="submit">
                  {isEmailVerificationStep ? "Verify email" : "Verify and continue"}
                </Btn>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Btn
                    className="w-full"
                    variant="ghost"
                    onClick={() => {
                      setStep("credentials");
                      setCode(["", "", "", "", "", ""]);
                      setErrors({});
                    }}
                  >
                    Back
                  </Btn>
                  <Btn
                    className="w-full"
                    variant="secondary"
                    onClick={() => {
                      setCode(["", "", "", "", "", ""]);
                      setErrors({});
                    }}
                  >
                    Resend code
                  </Btn>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
