import { useMemo, useRef, useState } from "react";

import type { AppRole } from "@/types/supplyed";

import { Btn, Checkbox, Field, Icon, Logo } from "../atoms";

type LoginRole = Extract<AppRole, "institution" | "teacher">;
type LoginErrors = Partial<Record<"email" | "password" | "code", string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function roleCopy(role: LoginRole) {
  if (role === "teacher") {
    return {
      title: "Supply teacher",
      description: "Access matched jobs, messages, calendar, and profile compliance.",
      icon: "user",
    };
  }

  return {
    title: "School / MAT",
    description: "Post cover, review ranked matches, message teachers, and manage bookings.",
    icon: "building",
  };
}

export function LoginPage({
  role,
  setRole,
  onLogin,
  onLanding,
  onSwitchSignup,
}: {
  role: AppRole;
  setRole: (role: LoginRole) => void;
  onLogin: () => void;
  onLanding: () => void;
  onSwitchSignup: (role?: LoginRole) => void;
}) {
  const activeRole: LoginRole = role === "teacher" ? "teacher" : "institution";
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [errors, setErrors] = useState<LoginErrors>({});
  const codeRefs = useRef<Array<HTMLInputElement | null>>([]);
  const codeValue = code.join("");

  const roleSummary = useMemo(() => roleCopy(activeRole), [activeRole]);

  function validateCredentials() {
    const nextErrors: LoginErrors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) nextErrors.email = "Enter your work email.";
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
    setStep(2);
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

  function handleVerificationSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateCode()) return;
    onLogin();
  }

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
            onClick={() => onSwitchSignup(activeRole)}
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
            Access your SupplyED workspace with clean compliance, role matching, messaging, and booking tools in one place.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {(["institution", "teacher"] as const).map((value) => {
              const option = roleCopy(value);
              const selected = activeRole === value;

              return (
                <button
                  key={value}
                  className="rounded-xl border p-4 text-left transition"
                  onClick={() => setRole(value)}
                  style={{
                    background: selected ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)",
                    borderColor: selected ? "var(--se)" : "rgba(255,255,255,0.12)",
                  }}
                  type="button"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-[var(--se)]">
                    <Icon name={option.icon} size={18} />
                  </div>
                  <div className="font-semibold">{option.title}</div>
                  <p className="mt-1 text-sm leading-6 text-white/55">{option.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative text-xs text-white/40">© 2026 SupplyED</div>
      </aside>

      <section className="flex min-h-[calc(100vh-340px)] items-center justify-center px-4 py-8 sm:px-6 lg:min-h-screen lg:px-12 lg:py-16">
        <div className="w-full max-w-[460px]">
          <div className="mb-7">
            <div className="eyebrow mb-2 text-[var(--se)]">Secure sign in</div>
            <h2 className="font-serif text-3xl leading-tight sm:text-[38px]">
              {step === 1 ? "Log in to SupplyED" : "Verify your identity"}
            </h2>
            <p className="mt-3 text-[var(--muted)]">
              {step === 1 ? (
                <>
                  New to SupplyED?{" "}
                  <button className="font-semibold text-[var(--se)]" onClick={() => onSwitchSignup(activeRole)} type="button">
                    Create an account
                  </button>
                </>
              ) : (
                <>Enter the 6-digit code sent to <span className="font-semibold text-[var(--ink)]">{email.trim()}</span>.</>
              )}
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-xs)] sm:p-7">
            {step === 1 ? (
              <form noValidate onSubmit={handleCredentialSubmit}>
                <div className="mb-5 rounded-lg border border-[var(--border)] bg-[var(--chalk)] p-4">
                  <div className="mb-1.5 flex items-center gap-2 font-semibold">
                    <Icon name={roleSummary.icon} size={16} className="text-[var(--se)]" />
                    {roleSummary.title}
                  </div>
                  <p className="text-sm leading-6 text-[var(--muted)]">{roleSummary.description}</p>
                </div>

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
                    placeholder="name@school.org.uk"
                    type="email"
                    value={email}
                  />
                </Field>

                <Field label="Password" htmlFor="login-password" error={errors.password} required>
                  <input
                    aria-invalid={Boolean(errors.password)}
                    autoComplete="current-password"
                    className="input"
                    id="login-password"
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setErrors((current) => ({ ...current, password: undefined }));
                    }}
                    placeholder="Enter your password"
                    type="password"
                    value={password}
                  />
                </Field>

                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                  <Checkbox checked={remember} onChange={setRemember} label="Remember this device" />
                  <button className="text-sm font-semibold text-[var(--se)]" type="button">Forgot password?</button>
                </div>

                <Btn className="w-full" size="lg" type="submit" iconRight="arrow">
                  Continue securely
                </Btn>
              </form>
            ) : (
              <form noValidate onSubmit={handleVerificationSubmit}>
                <Field label="Verification code" error={errors.code} required>
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
                  Keep this browser open while you check your email. Codes expire after 10 minutes.
                </div>

                <Btn className="w-full" size="lg" type="submit">
                  Verify and continue
                </Btn>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Btn
                    className="w-full"
                    variant="ghost"
                    onClick={() => {
                      setStep(1);
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
