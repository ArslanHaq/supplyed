import { useEffect, useState } from "react";

import { Btn, Field, Icon, Logo } from "../atoms";

type TwoFactorErrors = Partial<Record<"code", string>>;
type TwoFactorResult = { ok: true } | { fieldErrors?: TwoFactorErrors; message: string; ok: false };

function readExpiryText(expiresAt: number, now: number) {
  const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function TwoFactorChallengePage({
  email,
  expiresAt,
  notice,
  onBack,
  onLanding,
  onVerified,
}: {
  email: string;
  expiresAt?: number;
  notice?: string;
  onBack: () => void;
  onLanding: () => void;
  onVerified: (code: string) => Promise<TwoFactorResult>;
}) {
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<TwoFactorErrors>({});
  const [now, setNow] = useState(() => Date.now());
  const [pending, setPending] = useState(false);
  const normalizedCode = code.trim().toUpperCase();
  const expiryText = expiresAt ? readExpiryText(expiresAt, now) : null;

  useEffect(() => {
    if (!expiresAt) return undefined;

    const timer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(timer);
  }, [expiresAt]);

  function validate() {
    const validCode = /^(?:\d{6}|[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){3})$/i.test(normalizedCode);

    if (!validCode) {
      setErrors({ code: "Enter a 6-digit authenticator code or a recovery code." });
      return false;
    }

    setErrors({});
    return true;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !validate()) return;

    setPending(true);
    const result = await onVerified(normalizedCode);

    if (!result.ok) {
      setErrors(result.fieldErrors ?? { code: result.message });
      setPending(false);
      return;
    }

    setPending(false);
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-chalk lg:grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <aside className="relative flex min-h-[340px] flex-col justify-between overflow-hidden bg-[#0a0a0a] px-5 py-7 text-white sm:px-8 sm:py-10 lg:min-h-screen lg:px-14 lg:py-16">
        <div className="absolute inset-0 bg-[linear-gradient(rgb(var(--se-rgb)/0.08)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--se-rgb)/0.08)_1px,transparent_1px)] bg-[length:54px_54px]" />
        <div className="relative flex items-center justify-between gap-4">
          <Logo size={22} className="text-white" onClick={onLanding} />
          <Btn className="border-white/15 text-white hover:bg-white/10 hover:text-white" variant="ghost" size="sm" onClick={onBack}>
            Back
          </Btn>
        </div>

        <div className="relative my-12 max-w-[540px] lg:my-0">
          <div className="eyebrow mb-5 text-brand">Second step</div>
          <h1 className="text-5xl font-bold leading-[0.98] text-white sm:text-6xl lg:text-[68px]">
            Verify this
            <br />
            sign in.
          </h1>
          <p className="mt-7 max-w-[520px] text-lg leading-8 text-white/62 sm:text-xl">
            This account uses an authenticator app. Enter the current code, or use one saved recovery code.
          </p>
        </div>

        <div className="relative text-xs text-white/40">Protected by two-factor authentication</div>
      </aside>

      <section className="flex min-h-[calc(100vh-340px)] items-center justify-center px-4 py-8 sm:px-6 lg:min-h-screen lg:px-12 lg:py-16">
        <div className="w-full max-w-[460px]">
          <div className="mb-7">
            <div className="eyebrow mb-2 text-brand">Authenticator code</div>
            <h2 className="font-serif text-3xl leading-tight sm:text-[38px]">Enter your security code.</h2>
            <p className="mt-3 text-muted">
              We verified the password for <span className="font-semibold text-ink">{email || "this account"}</span>.
            </p>
          </div>

          <form className="rounded-xl border border-border bg-white p-5 shadow-(--shadow-xs) sm:p-7" noValidate onSubmit={handleSubmit}>
            {notice ? (
              <div className="mb-5 rounded-lg border border-brand/20 bg-brand-tint p-4 text-sm leading-6 text-brand-dark">
                {notice}
              </div>
            ) : null}

            <Field error={errors.code} htmlFor="login-two-factor-code" label="Code or recovery code" required>
              <div className="relative">
                <input
                  aria-invalid={Boolean(errors.code)}
                  autoComplete="one-time-code"
                  autoFocus
                  className="input pr-12 tracking-[0.12em]"
                  id="login-two-factor-code"
                  inputMode="text"
                  maxLength={19}
                  onChange={(event) => {
                    setCode(event.target.value);
                    setErrors({});
                  }}
                  placeholder="123456"
                  value={code}
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-brand">
                  <Icon name="shield" size={18} />
                </span>
              </div>
            </Field>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
              <span>Recovery format: XXXX-XXXX-XXXX-XXXX</span>
              {expiryText ? <span className="font-semibold text-brand">Expires in {expiryText}</span> : null}
            </div>

            <Btn className="mt-6 w-full" iconRight="arrow" loading={pending} loadingLabel="Verifying" size="lg" type="submit">
              Continue securely
            </Btn>
          </form>
        </div>
      </section>
    </div>
  );
}
