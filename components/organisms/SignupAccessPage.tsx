import { useState } from "react";

import { passwordRequirementsMessage, validatePassword } from "@/features/auth/schemas";
import type { SocialAuthAvailability } from "@/types/supplyed";

import { Btn, Checkbox, Field, Logo } from "../atoms";
import {
  ConfirmPasswordMismatch,
  hasConfirmPasswordMismatch,
  PasswordRequirementHint,
  passwordMismatchMessage,
  SocialAuthButtons,
} from "../molecules";
import { PasswordInput } from "../atoms/PasswordInput";

type AccessErrors = Partial<Record<"email" | "password" | "confirmPassword" | "termsAccepted", string>>;
type AccessResult = { ok: true } | { fieldErrors?: AccessErrors; message: string; ok: false };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fieldClass(error?: string) {
  return `input ${error ? "border-danger bg-danger-tint" : ""}`;
}

export function SignupAccessPage({
  onLanding,
  onLogin,
  onAccountCreated,
  onGoogleAuth,
  onMicrosoftAuth,
  socialAuth,
}: {
  onLanding: () => void;
  onLogin: () => void;
  onAccountCreated: (email: string, password: string) => Promise<AccessResult>;
  onGoogleAuth: () => void;
  onMicrosoftAuth: () => void;
  socialAuth: SocialAuthAvailability;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState<AccessErrors>({});
  const [pending, setPending] = useState(false);

  function validate() {
    const nextErrors: AccessErrors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) nextErrors.email = "Enter your email address.";
    else if (!emailPattern.test(trimmedEmail)) nextErrors.email = "Use a valid email address.";
    if (!password) nextErrors.password = "Create a password.";
    else if (!validatePassword(password)) nextErrors.password = passwordRequirementsMessage;
    if (!confirmPassword) nextErrors.confirmPassword = "Confirm your password.";
    else if (confirmPassword !== password) nextErrors.confirmPassword = passwordMismatchMessage;
    if (!termsAccepted) nextErrors.termsAccepted = "Accept the terms to continue.";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!validate()) return;
    setPending(true);
    const result = await onAccountCreated(email.trim(), password);

    if (!result.ok) {
      setErrors(result.fieldErrors ?? { email: result.message });
      setPending(false);
      return;
    }

    setPending(false);
  }

  const confirmPasswordMismatch = hasConfirmPasswordMismatch(password, confirmPassword);
  const passwordError = errors.password === passwordRequirementsMessage ? undefined : errors.password;
  const confirmPasswordError =
    confirmPasswordMismatch || errors.confirmPassword === passwordMismatchMessage ? undefined : errors.confirmPassword;

  return (
    <div className="min-h-screen overflow-x-hidden bg-chalk lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <aside className="relative flex min-h-[330px] flex-col justify-between overflow-hidden bg-[#0a0a0a] px-5 py-7 text-white sm:px-8 sm:py-10 lg:min-h-screen lg:px-14 lg:py-16">
        <div className="absolute inset-0 bg-[linear-gradient(rgb(var(--se-rgb)/0.08)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--se-rgb)/0.08)_1px,transparent_1px)] bg-[length:54px_54px]" />
        <div className="relative flex items-center justify-between gap-4">
          <Logo size={22} className="text-white" onClick={onLanding} />
          <Btn className="border-white/15 text-white hover:bg-white/10 hover:text-white" variant="ghost" size="sm" onClick={onLogin}>
            Log in
          </Btn>
        </div>

        <div className="relative my-12 max-w-[520px] lg:my-0">
          <div className="eyebrow mb-5 text-brand">Create account</div>
          <h1 className="font-serif text-4xl leading-[1.05] sm:text-5xl lg:text-[54px]">
            Start with secure access,
            <br />
            then complete onboarding.
          </h1>
          <p className="mt-5 text-base leading-7 text-white/65">
            Create your login first. After email verification, SupplyED signs you in and checks whether your role and application status are complete.
          </p>

          <div className="mt-8 grid gap-3">
            {[
              ["Account", "Email and password are created first."],
              ["Verify", "The email must be verified before onboarding."],
              ["Onboard", "Role is selected only after the user is signed in."],
            ].map(([title, copy], index) => (
              <div key={title} className="flex gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-brand">
                  {index + 1}
                </div>
                <div>
                  <div className="font-semibold">{title}</div>
                  <div className="text-sm leading-6 text-white/55">{copy}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs text-white/40">Step 1 of 3 - Account</div>
      </aside>

      <section className="flex min-h-[calc(100vh-330px)] items-center justify-center px-4 py-8 sm:px-6 lg:min-h-screen lg:px-12 lg:py-16">
        <div className="w-full max-w-[720px]">
          <div className="mb-7">
            <div className="eyebrow mb-2 text-brand">Account details</div>
            <h2 className="font-serif text-3xl leading-tight sm:text-[38px]">Create your SupplyED account.</h2>
            <p className="mt-3 text-muted">
              Already registered?{" "}
              <button className="font-semibold text-brand" onClick={onLogin} type="button">
                Log in
              </button>
            </p>
          </div>

          <form className="rounded-xl border border-border bg-white p-5 shadow-(--shadow-xs) sm:p-7" noValidate onSubmit={handleSubmit}>
            <SocialAuthButtons
              available={socialAuth}
              disabled={pending}
              intent="signup"
              onGoogle={onGoogleAuth}
              onMicrosoft={onMicrosoftAuth}
            />

            <div className="grid gap-x-4 sm:grid-cols-2">
              <Field label="Email address" htmlFor="signup-access-email" error={errors.email} required>
                <input
                  autoComplete="email"
                  className={fieldClass(errors.email)}
                  disabled={pending}
                  id="signup-access-email"
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
              <Field label="Password" htmlFor="signup-access-password" error={passwordError} required>
                <PasswordInput
                  autoComplete="new-password"
                  className={fieldClass(passwordError)}
                  disabled={pending}
                  id="signup-access-password"
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setErrors((current) => ({ ...current, password: undefined }));
                  }}
                  placeholder="Create a password"
                  value={password}
                />
                <PasswordRequirementHint password={password} />
              </Field>
              <Field label="Confirm password" htmlFor="signup-access-confirm" error={confirmPasswordError} required>
                <PasswordInput
                  autoComplete="new-password"
                  className={fieldClass(confirmPasswordError)}
                  disabled={pending}
                  id="signup-access-confirm"
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setErrors((current) => ({ ...current, confirmPassword: undefined }));
                  }}
                  placeholder="Repeat your password"
                  value={confirmPassword}
                />
                <ConfirmPasswordMismatch confirmPassword={confirmPassword} password={password} />
              </Field>
            </div>

            <Field error={errors.termsAccepted}>
              <Checkbox
                checked={termsAccepted}
                onChange={(value) => {
                  setTermsAccepted(value);
                  setErrors((current) => ({ ...current, termsAccepted: undefined }));
                }}
                label="I agree to SupplyED's verification, privacy, and marketplace terms."
              />
            </Field>

            <Btn className="mt-2 w-full" loading={pending} loadingLabel="Creating account" size="lg" type="submit" iconRight="arrow">
              Create account
            </Btn>
          </form>
        </div>
      </section>
    </div>
  );
}
