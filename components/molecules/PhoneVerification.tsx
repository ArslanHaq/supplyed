"use client";

import { useEffect, useId, useState } from "react";

import type { PhoneOtpChallenge } from "@/features/auth/phone-types";
import { useSendPhoneOtp, useVerifyPhoneOtp } from "@/features/auth/use-phone-verification";

import { Btn, Field, Tag } from "../atoms";

type ActiveChallenge = PhoneOtpChallenge & { expiresAt: number; resendAt: number };

export function PhoneVerification({
  disabled,
  error,
  hidePhoneInput = false,
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
  const [failure, setFailure] = useState<{ message: string; requestId?: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [rateLimitUntil, setRateLimitUntil] = useState(0);
  const send = useSendPhoneOtp();
  const verify = useVerifyPhoneOtp();
  const busy = send.isPending || verify.isPending;
  const matchesChallenge = Boolean(challenge && phone.trim() === challenge.phone);
  const isVerified = verified && Boolean(savedPhone) && phone.trim() === savedPhone;
  const resendSeconds = Math.max(0, Math.ceil((Math.max(challenge?.resendAt ?? 0, rateLimitUntil) - now) / 1000));
  const expirySeconds = Math.max(0, Math.ceil(((challenge?.expiresAt ?? 0) - now) / 1000));

  useEffect(() => {
    if (!challenge && !rateLimitUntil) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [challenge, rateLimitUntil]);

  async function sendCode() {
    if (busy || disabled || resendSeconds > 0 || !phone.trim() || isVerified) return;
    setFailure(null);
    try {
      const result = await send.mutateAsync({ phone });
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
    if (busy || disabled || !matchesChallenge || expirySeconds <= 0 || !/^\d{6}$/.test(otp)) return;
    setFailure(null);
    try {
      const result = await verify.mutateAsync({ otp });
      if (!result.ok) {
        setFailure({ message: result.message, requestId: result.requestId });
        return;
      }
      onChange(result.data.phone);
      onVerified?.(result.data.phone);
      setChallenge(null);
      setOtp("");
    } catch {
      setFailure({ message: "Could not verify the code. Check your connection and try again." });
    }
  }

  const verificationButton = isVerified ? <Tag tone="green">Phone verified</Tag> : (
    <Btn disabled={disabled || verify.isPending || !phone.trim() || resendSeconds > 0}
      loading={send.isPending} loadingLabel="Sending code" onClick={() => void sendCode()} size="sm" variant="secondary">
      {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : challenge ? "Resend code" : "Verify phone"}
    </Btn>
  );

  return (
    <div>
      {hidePhoneInput ? (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {verificationButton}
          {phone ? <span className="text-sm text-muted">We will send the code to the phone number saved on your profile.</span> : null}
        </div>
      ) : (
        <Field error={error} htmlFor={`${id}-phone`} label="Phone number" required={required}
          hint="Use your country code. Numbers without a country code are treated as UK numbers.">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              autoComplete="tel"
              className={`input min-w-0 flex-1 ${error ? "border-danger" : ""}`}
              disabled={disabled || busy}
              id={`${id}-phone`}
              inputMode="tel"
              maxLength={30}
              onChange={(event) => { onChange(event.target.value); setFailure(null); }}
              placeholder="+44 7700 900000"
              type="tel"
              value={phone}
            />
            {verificationButton}
          </div>
        </Field>
      )}

      {matchesChallenge && challenge && !isVerified ? (
        <div className="mb-4 rounded-lg border border-border bg-chalk p-4">
          <p className="mb-3 text-sm text-muted" role="status">
            {expirySeconds > 0
              ? `Code sent to ${challenge.phone}. Expires in ${Math.floor(expirySeconds / 60)}:${String(expirySeconds % 60).padStart(2, "0")}.`
              : "This code has expired. Request a new code to continue."}
          </p>
          <Field htmlFor={`${id}-otp`} label="SMS verification code">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                autoComplete="one-time-code"
                className="input min-w-0 flex-1 tracking-widest"
                disabled={disabled || busy || expirySeconds <= 0}
                id={`${id}-otp`}
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => { setOtp(event.target.value.replace(/\D/g, "").slice(0, 6)); setFailure(null); }}
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void verifyCode(); } }}
                pattern="[0-9]{6}"
                placeholder="123456"
                value={otp}
              />
              <Btn disabled={disabled || send.isPending || expirySeconds <= 0 || !/^\d{6}$/.test(otp)}
                loading={verify.isPending} loadingLabel="Verifying" onClick={() => void verifyCode()} size="sm">
                Confirm phone
              </Btn>
            </div>
          </Field>
        </div>
      ) : null}

      {failure ? (
        <div className="mb-4 text-sm text-danger" role="alert">
          {failure.message}
          {failure.requestId ? <span className="mt-1 block text-xs">Support reference: {failure.requestId}</span> : null}
        </div>
      ) : null}
      {verified && savedPhone && !isVerified ? (
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
