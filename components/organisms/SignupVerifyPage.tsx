import { useEffect, useRef, useState } from "react";

import { Btn, Field, Icon, Logo } from "../atoms";

type VerifyErrors = Partial<Record<"code", string>>;
type VerifyPending = "verify" | "resend" | null;

export function SignupVerifyPage({
  email,
  onBack,
  onLanding,
  onLogin,
  onVerified,
}: {
  email: string;
  onBack: () => void;
  onLanding: () => void;
  onLogin: () => void;
  onVerified: () => void;
}) {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [errors, setErrors] = useState<VerifyErrors>({});
  const [pending, setPending] = useState<VerifyPending>(null);
  const codeRefs = useRef<Array<HTMLInputElement | null>>([]);
  const pendingTimerRef = useRef<number | null>(null);
  const codeValue = code.join("");

  useEffect(() => {
    return () => {
      if (pendingTimerRef.current) window.clearTimeout(pendingTimerRef.current);
    };
  }, []);

  function runPending(kind: Exclude<VerifyPending, null>, callback: () => void) {
    if (pendingTimerRef.current) window.clearTimeout(pendingTimerRef.current);
    setPending(kind);
    pendingTimerRef.current = window.setTimeout(() => {
      callback();
      setPending(null);
    }, 420);
  }

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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!validate()) return;
    runPending("verify", onVerified);
  }

  function resendCode() {
    runPending("resend", () => {
      setCode(["", "", "", "", "", ""]);
      setErrors({});
      codeRefs.current[0]?.focus();
    });
  }

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

        <div className="relative my-12 max-w-[500px] lg:my-0">
          <div className="eyebrow mb-5 text-brand">Verify email</div>
          <h1 className="font-serif text-4xl leading-[1.05] sm:text-5xl lg:text-[54px]">
            Confirm the email,
            <br />
            then continue setup.
          </h1>
          <p className="mt-5 text-base leading-7 text-white/65">
            Verification protects the account before profile, learner, or compliance details are collected.
          </p>
        </div>

        <div className="relative text-xs text-white/40">Step 2 of 3 - Verification</div>
      </aside>

      <section className="flex min-h-[calc(100vh-330px)] items-center justify-center px-4 py-8 sm:px-6 lg:min-h-screen lg:px-12 lg:py-16">
        <div className="w-full max-w-[460px]">
          <div className="mb-7">
            <div className="eyebrow mb-2 text-brand">Email code</div>
            <h2 className="font-serif text-3xl leading-tight sm:text-[38px]">Enter your 6-digit code.</h2>
            <p className="mt-3 text-muted">
              We sent a verification code to <span className="font-semibold text-ink">{email || "your email"}</span>.
            </p>
          </div>

          <form className="rounded-xl border border-border bg-white p-5 shadow-(--shadow-xs) sm:p-7" noValidate onSubmit={handleSubmit}>
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
              This prototype accepts any 6-digit code. In production, the backend would store the email verification challenge and expiry.
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
                loading={pending === "resend"}
                loadingLabel="Sending"
                variant="secondary"
                onClick={resendCode}
              >
                Resend code
              </Btn>
            </div>

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
