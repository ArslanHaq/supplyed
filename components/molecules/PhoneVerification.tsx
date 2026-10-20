"use client";

import { useEffect, useId, useState } from "react";

import type { PhoneOtpChallenge } from "@/features/auth/phone-types";
import { useSendPhoneOtp, useVerifyPhoneOtp } from "@/features/auth/use-phone-verification";
import { validateUkPhone } from "@/lib/uk-validation";

import { Btn, Field, Icon, Tag } from "../atoms";
import { PhoneInput } from "./PhoneInput";

type ActiveChallenge = PhoneOtpChallenge & { expiresAt: number; resendAt: number };

export function PhoneVerification({
  disabled,
  error,
  hidePhoneInput = false,
  inputId,
  onChange,
  onVerified,
  phone,
  required,
  savedPhone,
  verified,
}: {
  disabled?: boolean;
  error?: string;
  hidePhoneInput?: boolean;
  inputId?: string;
  onChange: (phone: string) => void;
  onVerified?: (phone: string) => void;
  phone: string;
  required?: boolean;
  savedPhone: string;
  verified: boolean;
}) {
  const id = useId();
  const [challenge, setChallenge] = useState<ActiveChallenge | null>(null);
  const [otp, setOtp] = useState("");
  const [failure, setFailure] = useState<{ message: string; requestId?: string; field?: "otp" } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [rateLimitUntil, setRateLimitUntil] = useState(0);
  const send = useSendPhoneOtp();
  const verify = useVerifyPhoneOtp();
  const busy = send.isPending || verify.isPending;
  const phoneValidation = validateUkPhone(phone, { required: true });
  const savedPhoneValidation = validateUkPhone(savedPhone, { required: true });
  const matchesChallenge = Boolean(phoneValidation.valid && challenge && phoneValidation.value === challenge.phone);
  const isVerified = verified && savedPhoneValidation.valid && phoneValidation.valid && phoneValidation.value === savedPhoneValidation.value;
  const resendSeconds = Math.max(0, Math.ceil((Math.max(challenge?.resendAt ?? 0, rateLimitUntil) - now) / 1000));
  const expirySeconds = Math.max(0, Math.ceil(((challenge?.expiresAt ?? 0) - now) / 1000));
  const codeRejected = failure?.field === "otp" && /code|otp/i.test(failure.message) && /invalid|incorrect|expired/i.test(failure.message);

  useEffect(() => {
    if (!challenge && !rateLimitUntil) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [challenge, rateLimitUntil]);

  async function sendCode() {
    if (busy || disabled || resendSeconds > 0 || isVerified) return;
    if (!phoneValidation.valid) {
      setFailure({ message: phoneValidation.error! });
      return;
    }
    setFailure(null);
    try {
      const result = await send.mutateAsync({ phone: phoneValidation.value });
      const receivedAt = Date.now();
      setNow(receivedAt);
      if (!result.ok) {
        setFailure({ message: result.message, requestId: result.requestId });
        const waitSeconds = /Please wait (\d+) seconds/i.exec(result.message)?.[1];
        if (waitSeconds) setRateLimitUntil(receivedAt + Number(waitSeconds) * 1000);
        return;
      }
      setChallenge({
        ...result.data,
        expiresAt: receivedAt + result.data.expiresInMinutes * 60_000,
        resendAt: receivedAt + result.data.resendAvailableInSeconds * 1000,
      });
      setRateLimitUntil(0);
      setOtp("");
      onChange(result.data.phone);
    } catch {
      setFailure({ message: "Could not send the code. Check your connection and try again." });
    }
  }

  async function verifyCode() {
    if (busy || disabled) return;
    if (!matchesChallenge) { setFailure({ message: "Re-enter the UK number this code was sent to, or request a new code.", field: "otp" }); return; }
    if (expirySeconds <= 0) { setFailure({ message: "Request a new code for your UK phone number.", field: "otp" }); return; }
    if (!/^\d{6}$/.test(otp)) { setFailure({ message: "Enter the six-digit verification code.", field: "otp" }); return; }
    setFailure(null);
    try {
      const result = await verify.mutateAsync({ otp });
      if (!result.ok) {
        setFailure({ message: result.message, requestId: result.requestId, field: "otp" });
        return;
      }
      onChange(result.data.phone);
      onVerified?.(result.data.phone);
      setChallenge(null);
      setOtp("");
    } catch {
      setFailure({ message: "Could not verify the code. Check your connection and try again.", field: "otp" });
    }
  }

  const verificationButton = isVerified ? <Tag tone="green">Phone verified</Tag> : (
    <Btn className="phone-verification-action" style={{ minHeight: "var(--phone-control-height, var(--control-height))" }} disabled={disabled || verify.isPending || !phoneValidation.valid || resendSeconds > 0}
      loading={send.isPending} loadingLabel="Sending code" onClick={() => void sendCode()}>
      {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : challenge ? "Resend code" : "Verify phone"}
    </Btn>
  );

  return (
    <div>
      {hidePhoneInput && phoneValidation.valid ? (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {verificationButton}
          {phone ? <span className="text-sm text-muted">We will send the code to the phone number saved on your profile.</span> : null}
        </div>
      ) : (
        <div className="mb-4">
          <PhoneInput action={verificationButton} error={error || (phone && !phoneValidation.valid ? phoneValidation.error : undefined)} id={inputId || `${id}-phone`} required={required}
            disabled={disabled || busy} value={phone} onChange={(value) => { onChange(value); setFailure(null); }} />
        </div>
      )}

      {challenge && !isVerified ? (
        <div className="mb-4 rounded-lg border border-border bg-chalk p-4">
          <p className="mb-3 text-sm text-muted" role="status">
            {expirySeconds > 0
              ? `Code sent to ${challenge.phone}. Expires in ${Math.floor(expirySeconds / 60)}:${String(expirySeconds % 60).padStart(2, "0")}.`
              : "This code has expired. Request a new code to continue."}
          </p>
          {!matchesChallenge ? (
            <p className="mb-3 text-sm text-muted" id={`${id}-phone-mismatch`} role="status">
              This code is for {challenge.phone}. Re-enter that number, or request a new code for your updated UK number.
            </p>
          ) : null}
          <Field htmlFor={`${id}-otp`} label="SMS verification code">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                aria-invalid={failure?.field === "otp"}
                aria-describedby={[!matchesChallenge ? `${id}-phone-mismatch` : "", failure?.field === "otp" ? `${id}-failure` : ""].filter(Boolean).join(" ") || undefined}
                autoComplete="one-time-code"
                className="input min-w-0 flex-1 tracking-widest"
                disabled={disabled || busy || expirySeconds <= 0}
                id={`${id}-otp`}
                inputMode="numeric"
                onChange={(event) => { const value = event.target.value; setOtp(value); if (/^\d{6}$/.test(value)) setFailure(null); }}
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void verifyCode(); } }}
                pattern="[0-9]{6}"
                placeholder="123456"
                value={otp}
              />
              <Btn className="phone-verification-action" style={{ minHeight: "var(--phone-control-height, var(--control-height))" }} disabled={disabled || send.isPending || !matchesChallenge || expirySeconds <= 0 || !/^\d{6}$/.test(otp)}
                loading={verify.isPending} loadingLabel="Verifying" onClick={() => void verifyCode()}>
                Confirm phone
              </Btn>
            </div>
          </Field>
        </div>
      ) : null}

      {failure ? (
        <div id={`${id}-failure`} className="mb-4 flex items-start gap-3 rounded-xl border border-danger/20 bg-danger-tint p-4 text-sm" role="alert">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-danger" aria-hidden="true">
            <Icon name="help" size={18} />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-danger">{failure.field === "otp" ? "Let's check your verification code" : "We couldn't send your code"}</p>
            <p className="mt-1 leading-6 text-ink">
              {codeRejected ? "That code is incorrect or has expired. Enter the latest 6-digit code from your SMS, or select Resend code to get a new one." : failure.message}
            </p>

          </div>
        </div>
      ) : null}
      {verified && savedPhoneValidation.valid && !isVerified ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted">Your verified number is {savedPhone}. Verify the new number to replace it.</p>
          <Btn disabled={disabled || busy} onClick={() => { onChange(savedPhone); setFailure(null); }} size="sm" variant="ghost">
            Use verified number
          </Btn>
        </div>
      ) : null}
    </div>
  );
}
