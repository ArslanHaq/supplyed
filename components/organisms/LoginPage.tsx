import { useState } from "react";

import type { SocialAuthAvailability } from "@/types/supplyed";

import { Btn, Checkbox, Field, Icon, Logo } from "../atoms";
import { PasswordInput } from "../atoms/PasswordInput";
import { SocialAuthButtons } from "../molecules";

type LoginErrors = Partial<Record<"email" | "password", string>>;
type LoginResult = { message?: string; ok: true } | { fieldErrors?: LoginErrors; message: string; ok: false };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const signinBenefits = [
  "DBS-verified teacher network",
  "AI-powered job matching",
  "Same-day placement capability",
];

export function LoginPage({
  onGoogleAuth,
  onLogin,
  onLanding,
  onForgotPassword,
  onMicrosoftAuth,
  onSwitchSignup,
  socialAuth,
}: {
  onGoogleAuth: () => void;
  onLogin: (email: string, password: string) => Promise<LoginResult>;
  onLanding: () => void;
  onForgotPassword: () => void;
  onMicrosoftAuth: () => void;
  onSwitchSignup: () => void;
  socialAuth: SocialAuthAvailability;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [pending, setPending] = useState(false);

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

  async function handleCredentialSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!validateCredentials()) return;

    setPending(true);
    const result = await onLogin(email.trim(), password);

    if (!result.ok) {
      setErrors(result.fieldErrors ?? { password: result.message });
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-chalk lg:grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
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

        <div className="relative my-12 max-w-[540px] lg:my-0">
          <h1 className="text-5xl font-bold leading-[0.98] text-white sm:text-6xl lg:text-[68px]">
            Welcome back
            <br />
            to Supply<span className="text-brand">ED</span>
          </h1>
          <p className="mt-7 max-w-[520px] text-lg leading-8 text-white/62 sm:text-xl">
            Log in to access your dashboard, manage jobs, and connect with schools or teachers across the UK.
          </p>
          <ul className="mt-10 grid gap-5 text-base text-white/72 sm:text-lg">
            {signinBenefits.map((benefit) => (
              <li key={benefit} className="flex items-center gap-4">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-tint text-brand">
                  <Icon name="check" size={17} />
                </span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-xs text-white/40">© 2026 SupplyED</div>
      </aside>

      <section className="flex min-h-[calc(100vh-340px)] items-center justify-center px-4 py-8 sm:px-6 lg:min-h-screen lg:px-12 lg:py-16">
        <div className="w-full max-w-[460px]">
          <div className="mb-7">
            <div className="eyebrow mb-2 text-brand">Secure sign in</div>
            <h2 className="font-serif text-3xl leading-tight sm:text-[38px]">Log in to SupplyED</h2>
            <p className="mt-3 text-muted">
              New to SupplyED?{" "}
              <button className="font-semibold text-brand" onClick={onSwitchSignup} type="button">
                Create an account
              </button>
            </p>
          </div>

          <form className="rounded-xl border border-border bg-white p-5 shadow-(--shadow-xs) sm:p-7" noValidate onSubmit={handleCredentialSubmit}>
            <SocialAuthButtons available={socialAuth} disabled={pending} onGoogle={onGoogleAuth} onMicrosoft={onMicrosoftAuth} />

            <Field label="Email address" htmlFor="login-email" error={errors.email} required>
              <input
                aria-invalid={Boolean(errors.email)}
                autoComplete="email"
                className="input"
                disabled={pending}
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
                disabled={pending}
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
              <button
                className="text-sm font-semibold text-brand disabled:cursor-not-allowed disabled:opacity-50"
                disabled={pending}
                onClick={onForgotPassword}
                type="button"
              >
                Forgot password?
              </button>
            </div>

            <Btn className="w-full" loading={pending} loadingLabel="Signing in" size="lg" type="submit" iconRight="arrow">
              Continue securely
            </Btn>
          </form>
        </div>
      </section>
    </div>
  );
}
