import { useState } from "react";

import { passwordRequirementsMessage, validatePassword } from "@/features/auth/schemas";
import type { FoundingSignupType } from "@/lib/founding-signup-intent";
import type { AppRole, SocialAuthAvailability } from "@/types/supplyed";

import { Btn, Checkbox, Field, Icon, Logo } from "../atoms";
import {
  ConfirmPasswordMismatch,
  hasConfirmPasswordMismatch,
  PasswordRequirementHint,
  passwordMismatchMessage,
  SocialAuthButtons,
} from "../molecules";
import { PasswordInput } from "../atoms/PasswordInput";
import { AuthProgress } from "./AuthProgress";

type AccessErrors = Partial<Record<"role" | "email" | "password" | "confirmPassword" | "termsAccepted", string>>;
type AccessResult = { ok: true } | { fieldErrors?: AccessErrors; message: string; ok: false };

const accountRoleOptions = [
  ["institution", "School / MAT", "building", "Post roles, review ranked matches, and manage compliance."],
  ["teacher", "Supply teacher", "user", "Build your profile, find roles, and manage availability."],
] as const;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fieldClass(error?: string) {
  return `input ${error ? "border-danger bg-danger-tint" : ""}`;
}

export function SignupAccessPage({
  foundingType,
  initialEmail,
  onLanding,
  onLogin,
  onAccountCreated,
  onGoogleAuth,
  onMicrosoftAuth,
  socialAuth,
}: {
  foundingType?: FoundingSignupType;
  initialEmail?: string;
  onLanding: () => void;
  onLogin: () => void;
  onAccountCreated: (email: string, password: string, role: AppRole) => Promise<AccessResult>;
  onGoogleAuth: () => void;
  onMicrosoftAuth: () => void;
  socialAuth: SocialAuthAvailability;
}) {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState<AccessErrors>({});
  const [pending, setPending] = useState(false);
  const isFoundingSignup = Boolean(foundingType);
  const expectedEmail = initialEmail?.trim().toLowerCase();
  const [role, setRole] = useState<AppRole | null>(
    isFoundingSignup ? (foundingType === "teacher" ? "teacher" : "institution") : null
  );

  function validate() {
    const nextErrors: AccessErrors = {};
    const trimmedEmail = email.trim();
    const normalizedEmail = trimmedEmail.toLowerCase();

    if (!role) nextErrors.role = "Choose an account type.";
    if (!trimmedEmail) nextErrors.email = "Enter your email address.";
    else if (!emailPattern.test(trimmedEmail)) nextErrors.email = "Use a valid email address.";
    else if (expectedEmail && normalizedEmail !== expectedEmail) {
      nextErrors.email = "Use the same email address you entered in the interest form.";
    }
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
    const result = await onAccountCreated(email.trim(), password, role!);

    if (!result.ok) {
      setErrors(result.fieldErrors ?? { email: result.message });
      setPending(false);
      return;
    }

    setPending(false);
  }

  function startSocialSignup(handler: () => void) {
    if (!role) {
      setErrors((current) => ({ ...current, role: "Choose an account type before using social sign-up." }));
      return;
    }

    document.cookie = `supplyed_signup_role=${role}; path=/; max-age=3600; SameSite=Lax`;
    handler();
  }

  const confirmPasswordMismatch = hasConfirmPasswordMismatch(password, confirmPassword);
  const passwordError = errors.password === passwordRequirementsMessage ? undefined : errors.password;
  const confirmPasswordError =
    confirmPasswordMismatch || errors.confirmPassword === passwordMismatchMessage ? undefined : errors.confirmPassword;

  return (
    <div className="auth-shell auth-shell-signup">
      <aside className="auth-aside">
        <div className="auth-aside-rule" aria-hidden="true" />
        <div className="relative flex items-center justify-between gap-4">
          <Logo size={22} className="text-white" onClick={onLanding} />
          <Btn className="border-white/15 text-white hover:bg-white/10 hover:text-white" variant="ghost" size="sm" onClick={onLogin}>
            Log in
          </Btn>
        </div>

        <div className="auth-story">
          <div className="eyebrow">{isFoundingSignup ? "Founding signup" : "Create account"}</div>
          <h1 className="font-heading text-white">
            Start with secure access,
            <br />{" "}
            then complete onboarding.
          </h1>
          <p className="auth-story-description">
            {isFoundingSignup
              ? "Your interest details are saved. Create your login with the same email, then continue the right onboarding path."
              : "Create your login first. After email verification, SupplyED signs you in and checks whether your role and application status are complete."}
          </p>

          <div className="auth-journey">
            {[
              ["Account", "Email and password are created first."],
              ["Verify", "The email must be verified before onboarding."],
              [
                "Onboard",
                isFoundingSignup
                  ? foundingType === "teacher"
                    ? "Your teacher path opens after verification."
                    : "Your school path opens after verification."
                  : "Onboarding for your selected role starts after verification.",
              ],
            ].map(([title, copy], index) => (
              <div key={title} className="auth-journey-item">
                <div className="flex shrink-0 items-center justify-center rounded-full font-bold">
                  {index + 1}
                </div>
                <div>
                  <div className="font-semibold">{title}</div>
                  <div className="auth-journey-copy">{copy}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="auth-aside-footer">Step 1 of 3 - Account</div>
      </aside>

      <section className="auth-main">
        <div className="auth-main-inner auth-main-inner-wide">
          <AuthProgress current={1} />
          <div className="auth-form-heading">
            <div className="eyebrow mb-2 text-brand">Account details</div>
            <h2 className="font-heading">Create your SupplyED account.</h2>
            <p className="mt-3 text-muted">
              Already registered?{" "}
              <button className="font-semibold text-brand" onClick={onLogin} type="button">
                Log in
              </button>
            </p>
          </div>

          {isFoundingSignup ? (
            <div className="mb-5 rounded-xl border border-brand-tint-2 bg-brand-tint p-4 text-sm leading-6 text-brand-dark">
              Thanks, we received your {foundingType === "teacher" ? "teacher" : "school"} details. Use the same email to create your account so we can continue your onboarding.
            </div>
          ) : null}

          <form className="auth-form" method="post" noValidate onSubmit={handleSubmit}>
            <div className="mb-6">
              <Field label="Choose account type" error={errors.role} required>
                <div className="grid gap-3 sm:grid-cols-2">
                  {accountRoleOptions.map(([value, title, icon, copy]) => {
                    const selected = role === value;

                    return (
                      <button
                        key={value}
                        aria-pressed={selected}
                        className="account-role-option rounded-xl border p-4 text-left transition hover:border-brand hover:bg-brand-tint"
                        onClick={() => {
                          setRole(value);
                          setErrors((current) => ({ ...current, role: undefined }));
                        }}
                        style={{
                          background: selected ? "var(--se-tint)" : "#fff",
                          borderColor: selected ? "var(--se)" : "var(--border)",
                        }}
                        type="button"
                      >
                        <span className="account-role-check" aria-hidden="true">{selected ? <Icon name="check" size={12} /> : null}</span>
                        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white text-brand shadow-sm">
                          <Icon name={icon as "building" | "user" | "heart"} size={18} />
                        </div>
                        <div className="font-heading text-[17px] leading-snug">{title}</div>
                        <p className="mt-1 text-[13px] leading-5 text-muted">{copy}</p>
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>

            <SocialAuthButtons
              available={socialAuth}
              disabled={pending}
              intent="signup"
              onGoogle={() => startSocialSignup(onGoogleAuth)}
              onMicrosoft={() => startSocialSignup(onMicrosoftAuth)}
            />

            <div className="signup-credentials grid gap-x-4 sm:grid-cols-2">
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
                label={
                  <>
                    I agree to SupplyED&apos;s{" "}
                    <a className="font-semibold text-brand underline underline-offset-2" href="/terms" rel="noopener" target="_blank">
                      Terms &amp; Conditions
                    </a>
                    , including verification and privacy terms.
                  </>
                }
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
