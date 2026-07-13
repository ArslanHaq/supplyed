"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { requestPasswordResetAction } from "@/app/(auth)/forgot-password/actions";
import { startRouteLoading } from "@/lib/navigation-loading";

import { Btn, Field, Icon, Logo } from "../atoms";
import { PublicThemeControls } from "../molecules";

type ResetErrors = Partial<Record<"email", string>>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<ResetErrors>({});
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("If the email exists, a reset link will be sent.");

  function goLanding() {
    startRouteLoading();
    router.push("/");
  }

  function goLogin() {
    startRouteLoading();
    router.push("/login");
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

    setPending(true);
    const result = await requestPasswordResetAction(null, formData({ email: trimmedEmail }));
    setPending(false);

    if (!result.ok) {
      setErrors(result.fieldErrors ?? { email: result.message });
      return;
    }

    setEmail(trimmedEmail);
    setMessage(result.message ?? "If the email exists, a reset link will be sent.");
    setSubmitted(true);
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
              Request a reset link from SupplyED, then finish the password update through the secure link sent to your email.
            </p>
          </div>

          <div className="relative text-xs text-white/40">Account recovery</div>
        </aside>

        <section className="flex min-h-[calc(100vh-330px)] items-center justify-center px-4 py-8 sm:px-6 lg:min-h-screen lg:px-12 lg:py-16">
          <div className="w-full max-w-[500px]">
            <div className="mb-7">
              <div className="eyebrow mb-2 text-brand">Account recovery</div>
              <h2 className="font-serif text-3xl leading-tight sm:text-[38px]">
                {submitted ? "Check your email" : "Reset your password"}
              </h2>
              <p className="mt-3 text-muted">
                {submitted
                  ? "Use the reset link from SupplyED to choose a new password."
                  : "Enter the email used for your SupplyED account."}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-white p-5 shadow-(--shadow-xs) sm:p-7">
              {submitted ? (
                <div>
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-tint text-brand">
                    <Icon name="checkCircle" size={24} />
                  </div>
                  <div className="font-serif text-2xl">Reset request received.</div>
                  <p className="mt-3 text-sm leading-6 text-muted">{message}</p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Requested for <span className="font-semibold text-ink">{email}</span>.
                  </p>
                  <Btn className="mt-6 w-full" size="lg" onClick={goLogin} iconRight="arrow">
                    Back to login
                  </Btn>
                </div>
              ) : (
                <form noValidate onSubmit={requestReset}>
                  <Field label="Email address" htmlFor="reset-email" error={errors.email} required>
                    <input
                      aria-invalid={Boolean(errors.email)}
                      autoComplete="email"
                      className={fieldClass(errors.email)}
                      disabled={pending}
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

                  <Btn className="w-full" loading={pending} loadingLabel="Sending reset link" size="lg" type="submit" iconRight="arrow">
                    Send reset link
                  </Btn>
                </form>
              )}
            </div>
          </div>
        </section>
      </div>

      <PublicThemeControls />
    </>
  );
}
