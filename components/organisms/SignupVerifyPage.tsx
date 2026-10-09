import { useEffect, useRef, useState } from "react";

import { formatCodeResendCountdown, secondsUntilCodeResend } from "@/lib/code-resend-cooldown";

import { Btn, Field, Icon, Logo } from "../atoms";
import { AuthProgress } from "./AuthProgress";

type VerifyErrors = Partial<Record<"code", string>>;
type VerifyPending = "verify" | "resend" | null;
type VerifyResult = { ok: true } | { fieldErrors?: VerifyErrors; message: string; ok: false };

export function SignupVerifyPage({
  email,
  notice,
  onBack,
  onLanding,
  onLogin,
  onResend,
  onVerified,
  resendAvailableAt,
}: {
  email: string;
  notice?: string;
  onBack: () => void;
  onLanding: () => void;
  onLogin: () => void;
  onResend: () => Promise<VerifyResult>;
  onVerified: (code: string) => Promise<VerifyResult>;
  resendAvailableAt?: number;
}) {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [errors, setErrors] = useState<VerifyErrors>({});
  const [pending, setPending] = useState<VerifyPending>(null);
  const [resendRemainingSeconds, setResendRemainingSeconds] = useState(0);
  const codeRefs = useRef<Array<HTMLInputElement | null>>([]);
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

  function validate() {
    if (codeValue.length !== 6) {
      setErrors({ code: "Enter the 6-digit verification code." });
      return false;
    }

    setErrors({});
    return true;
  }

  function handleCodeChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setCode((current) => current.map((item, itemIndex) => (itemIndex === index ? digit : item)));
    setErrors({});

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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!validate()) return;
    setPending("verify");

    const result = await onVerified(codeValue);

    if (!result.ok) {
      setErrors(result.fieldErrors ?? { code: result.message });
      setPending(null);
      return;
    }

    setPending(null);
  }

  async function resendCode() {
    if (pending || resendLocked) return;
    setPending("resend");

    const result = await onResend();

    if (!result.ok) {
      setErrors(result.fieldErrors ?? { code: result.message });
      setPending(null);
      return;
    }

    setCode(["", "", "", "", "", ""]);
    setErrors({});
    setPending(null);
    window.setTimeout(() => codeRefs.current[0]?.focus(), 40);
  }

  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <div className="auth-aside-rule" aria-hidden="true" />
        <div className="relative flex items-center justify-between gap-4">
          <Logo size={22} className="text-white" onClick={onLanding} />
          <Btn className="border-white/15 text-white hover:bg-white/10 hover:text-white" variant="ghost" size="sm" onClick={onLogin}>
            Log in
          </Btn>
        </div>

        <div className="auth-story">
          <div className="eyebrow">Verify email</div>
          <h1 className="font-heading text-white">
            Confirm the email,
            <br />{" "}
            then continue setup.
          </h1>
          <p className="auth-story-description">
            Verification protects the account before profile, learner, or compliance details are collected.
          </p>
        </div>

        <div className="auth-aside-footer">Step 2 of 3 - Verification</div>
      </aside>

      <section className="auth-main">
        <div className="auth-main-inner">
          <AuthProgress current={2} />
          <div className="auth-form-heading">
            <div className="eyebrow mb-2 text-brand">Email code</div>
            <h2 className="font-heading">Enter your 6-digit code.</h2>
            <p className="mt-3 text-muted">
              We sent a verification code to <span className="font-semibold text-ink">{email || "your email"}</span>.
            </p>
          </div>

          <form className="auth-form" method="post" noValidate onSubmit={handleSubmit}>
            {notice ? (
              <div className="mb-5 rounded-lg border border-warning/30 bg-warning-tint p-4 text-sm leading-6 text-warning">
                {notice}
              </div>
            ) : null}

            <Field label="Verification code" error={errors.code} required>
              <div className="auth-code-grid">
                {code.map((digit, index) => (
                  <input
                    key={index}
                    ref={(node) => {
                      codeRefs.current[index] = node;
                    }}
                    aria-label={`Verification digit ${index + 1}`}
                    aria-invalid={Boolean(errors.code)}
                    autoComplete={index === 0 ? "one-time-code" : "off"}
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

            <div className="mb-6 rounded-lg bg-brand-tint p-4 text-sm leading-6 text-brand-dark">
              Codes are validated by SupplyED before your workspace session is created. You can request another code every 60 seconds.
            </div>

            <Btn className="w-full" loading={pending === "verify"} loadingLabel="Verifying email" size="lg" type="submit" iconRight="arrow">
              Verify and continue
            </Btn>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Btn className="w-full" disabled={Boolean(pending)} variant="ghost" onClick={onBack}>
                Back
              </Btn>
              <Btn
                className="w-full"
                disabled={Boolean(pending) || resendLocked}
                loading={pending === "resend"}
                loadingLabel="Sending"
                variant="secondary"
                onClick={resendCode}
              >
                {resendLocked ? `Resend in ${formatCodeResendCountdown(resendRemainingSeconds)}` : "Resend code"}
              </Btn>
            </div>

            {resendLocked ? (
              <p className="mt-3 text-center text-xs text-muted" aria-live="polite">
                The resend option becomes available again after 60 seconds.
              </p>
            ) : null}

            <div className="mt-5 flex items-center gap-2 rounded-lg bg-chalk px-3 py-2 text-xs text-muted">
              <Icon name="shield" size={14} className="text-brand" />
              After verification, SupplyED signs you in and checks whether role onboarding is needed.
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
