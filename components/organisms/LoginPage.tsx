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
    <div className="auth-shell">
      <aside className="auth-aside">
        <div className="auth-aside-rule" aria-hidden="true" />
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

        <div className="auth-story">
          <div className="auth-story-label"><span /> Your education network</div>
          <h1 className="font-heading text-white">
            Welcome back
            <br />{" "}
            to Supply<span className="text-brand">ED</span>
          </h1>
          <p className="auth-story-description">
            Log in to access your dashboard, manage jobs, and connect with schools or teachers across the UK.
          </p>
          <ul className="auth-benefits">
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

        <div className="auth-aside-footer"><span>© 2026 SupplyED</span><span>Built for education.</span></div>
      </aside>

      <section className="auth-main">
        <div className="auth-main-inner">
          <div className="auth-form-heading">
            <div className="eyebrow mb-2 text-brand">Secure sign in</div>
            <h2 className="font-heading">Log in to SupplyED</h2>
            <p className="mt-3 text-muted">
              New to SupplyED?{" "}
              <button className="font-semibold text-brand" onClick={onSwitchSignup} type="button">
                Create an account
              </button>
            </p>
          </div>

          <form className="auth-form" method="post" noValidate onSubmit={handleCredentialSubmit}>
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
          <p className="auth-security-note"><Icon name="shield" size={14} /> Secure access to your SupplyED workspace</p>
        </div>
      </section>
    </div>
  );
}
