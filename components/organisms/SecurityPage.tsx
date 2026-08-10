"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import {
  disableTwoFactorAction,
  enableTwoFactorAction,
  getTwoFactorStatusAction,
  regenerateTwoFactorRecoveryCodesAction,
  startTwoFactorSetupAction,
} from "@/features/auth/two-factor-actions";
import type { RouteProps } from "@/types/supplyed";

import { Btn, Field, Icon, Tag } from "../atoms";
import { PageHead, SectionLoader } from "../molecules";

type TwoFactorStatus = {
  enabled: boolean;
  recoveryCodesRemaining: number;
  setupPending: boolean;
};

type TwoFactorSetup = {
  otpAuthUri: string;
  qrCodeDataUrl: string;
  secret: string;
};

type SecurityPending = "disable" | "enable" | "load" | "recoveries" | "setup" | null;

function formData(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

function statusLabel(status?: TwoFactorStatus) {
  if (!status) return "Checking";
  if (status.enabled) return "Enabled";
  if (status.setupPending) return "Setup started";
  return "Disabled";
}

export function SecurityPage({ state, toast }: Pick<RouteProps, "state" | "toast">) {
  const [status, setStatus] = useState<TwoFactorStatus>();
  const [setup, setSetup] = useState<TwoFactorSetup>();
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [enableCode, setEnableCode] = useState("");
  const [manageCode, setManageCode] = useState("");
  const [codeError, setCodeError] = useState<string>();
  const [pending, setPending] = useState<SecurityPending>("load");

  useEffect(() => {
    let mounted = true;

    async function loadStatus() {
      const result = await getTwoFactorStatusAction();
      if (!mounted) return;

      if (!result.ok) {
        toast({ title: "Security status unavailable", msg: result.message, tone: "danger" });
        setPending(null);
        return;
      }

      setStatus(result.data);
      setPending(null);
    }

    void loadStatus();

    return () => {
      mounted = false;
    };
  }, [toast]);

  async function startSetup() {
    setPending("setup");
    setCodeError(undefined);
    const result = await startTwoFactorSetupAction();

    if (!result.ok) {
      toast({ title: "Could not start setup", msg: result.message, tone: "danger" });
      setPending(null);
      return;
    }

    setSetup(result.data);
    setRecoveryCodes([]);
    setStatus((current) => ({ enabled: false, recoveryCodesRemaining: current?.recoveryCodesRemaining ?? 0, setupPending: true }));
    setPending(null);
  }

  async function enableTwoFactor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("enable");
    setCodeError(undefined);
    const result = await enableTwoFactorAction(null, formData({ code: enableCode }));

    if (!result.ok) {
      setCodeError(result.fieldErrors?.code ?? result.message);
      toast({ title: "Could not enable 2FA", msg: result.message, tone: "danger" });
      setPending(null);
      return;
    }

    setStatus({ enabled: true, recoveryCodesRemaining: result.data.recoveryCodes.length, setupPending: false });
    setSetup(undefined);
    setEnableCode("");
    setRecoveryCodes(result.data.recoveryCodes);
    toast({ title: "Two-factor enabled", msg: "Save your recovery codes before leaving this page.", tone: "success" });
    setPending(null);
  }

  async function disableTwoFactor() {
    setPending("disable");
    setCodeError(undefined);
    const result = await disableTwoFactorAction(null, formData({ code: manageCode }));

    if (!result.ok) {
      setCodeError(result.fieldErrors?.code ?? result.message);
      toast({ title: "Could not disable 2FA", msg: result.message, tone: "danger" });
      setPending(null);
      return;
    }

    setStatus({ enabled: false, recoveryCodesRemaining: 0, setupPending: false });
    setManageCode("");
    setRecoveryCodes([]);
    toast({ title: "Two-factor disabled", msg: "This account now uses password sign-in only.", tone: "success" });
    setPending(null);
  }

  async function regenerateRecoveryCodes() {
    setPending("recoveries");
    setCodeError(undefined);
    const result = await regenerateTwoFactorRecoveryCodesAction(null, formData({ code: manageCode }));

    if (!result.ok) {
      setCodeError(result.fieldErrors?.code ?? result.message);
      toast({ title: "Could not regenerate codes", msg: result.message, tone: "danger" });
      setPending(null);
      return;
    }

    setRecoveryCodes(result.data.recoveryCodes);
    setStatus((current) => ({ enabled: true, recoveryCodesRemaining: result.data.recoveryCodes.length, setupPending: current?.setupPending ?? false }));
    setManageCode("");
    toast({ title: "Recovery codes updated", msg: "Old recovery codes can no longer be used.", tone: "success" });
    setPending(null);
  }

  async function copyRecoveryCodes() {
    if (recoveryCodes.length === 0) return;
    await navigator.clipboard.writeText(recoveryCodes.join("\n"));
    toast({ title: "Recovery codes copied", msg: "Keep them somewhere private and offline.", tone: "success" });
  }

  return (
    <div className="app-page">
      <PageHead
        title="Security"
        subtitle={`Protect ${state.signupEmail || "your account"} with an authenticator app and one-time recovery codes.`}
        actions={<Tag tone={status?.enabled ? "green" : status?.setupPending ? "amber" : "ghost"}>{statusLabel(status)}</Tag>}
      />

      {pending === "load" ? <SectionLoader rows={4} /> : null}

      {pending !== "load" ? (
        <div className="two-col">
          <div className="flex flex-col gap-5">
            <section className="card card-pad-lg">
              <div className="mb-4 flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-tint text-brand">
                  <Icon name="shield" size={22} />
                </span>
                <div>
                  <div className="section-title mb-1">Two-factor authentication</div>
                  <p className="text-sm leading-6 text-muted">
                    Use an authenticator app to require a second verification step after password sign-in.
                  </p>
                </div>
              </div>

              {status?.enabled ? (
                <div className="rounded-xl border border-success/25 bg-success-tint p-4 text-sm leading-6 text-success">
                  2FA is active. Login now requires either an authenticator code or one unused recovery code.
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-chalk p-4 text-sm leading-6 text-muted">
                  2FA is not enabled yet. Start setup, scan the QR code, then confirm the first code from your app.
                </div>
              )}

              {!status?.enabled ? (
                <Btn className="mt-5" icon="shield" loading={pending === "setup"} loadingLabel="Starting setup" onClick={startSetup}>
                  {setup ? "Restart setup" : "Set up authenticator"}
                </Btn>
              ) : null}
            </section>

            {setup ? (
              <section className="card card-pad-lg">
                <div className="section-title">Scan this QR code</div>
                <p className="mb-5 text-sm leading-6 text-muted">
                  Add SupplyED to Google Authenticator, Microsoft Authenticator, 1Password, or any TOTP app.
                </p>
                <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="rounded-xl border border-border bg-white p-4">
                    <Image
                      alt="Two-factor setup QR code"
                      className="h-auto w-full"
                      height={192}
                      src={setup.qrCodeDataUrl}
                      unoptimized
                      width={192}
                    />
                  </div>
                  <div>
                    <Field label="Manual setup key">
                      <input className="input font-mono text-sm" readOnly value={setup.secret} />
                    </Field>
                    <form className="mt-4" noValidate onSubmit={enableTwoFactor}>
                      <Field error={codeError} htmlFor="enable-2fa-code" label="Authenticator code" required>
                        <input
                          autoComplete="one-time-code"
                          className="input tracking-[0.18em]"
                          id="enable-2fa-code"
                          inputMode="numeric"
                          maxLength={6}
                          onChange={(event) => {
                            setEnableCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                            setCodeError(undefined);
                          }}
                          placeholder="123456"
                          value={enableCode}
                        />
                      </Field>
                      <Btn className="mt-4" loading={pending === "enable"} loadingLabel="Enabling" type="submit">
                        Enable 2FA
                      </Btn>
                    </form>
                  </div>
                </div>
              </section>
            ) : null}
          </div>

          <div className="flex flex-col gap-5">
            <section className="card card-pad-lg">
              <div className="section-title">Recovery codes</div>
              <p className="text-sm leading-6 text-muted">
                Recovery codes are one-time backup keys for account access if your authenticator device is unavailable.
              </p>
              <div className="mt-4 rounded-xl border border-border bg-chalk p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Codes remaining</div>
                <div className="mt-1 font-serif text-3xl">{status?.recoveryCodesRemaining ?? 0}</div>
              </div>

              {recoveryCodes.length > 0 ? (
                <div className="mt-4 rounded-xl border border-warning/30 bg-warning-tint p-4">
                  <div className="mb-3 text-sm font-semibold text-warning">Save these now. They are shown only once.</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {recoveryCodes.map((code) => (
                      <code key={code} className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-ink">
                        {code}
                      </code>
                    ))}
                  </div>
                  <Btn className="mt-4" icon="download" onClick={() => void copyRecoveryCodes()} variant="secondary">
                    Copy codes
                  </Btn>
                </div>
              ) : null}
            </section>

            {status?.enabled ? (
              <section className="card card-pad-lg">
                <div className="section-title">Manage 2FA</div>
                <p className="mb-4 text-sm leading-6 text-muted">
                  Enter a current authenticator code or one recovery code before changing 2FA settings.
                </p>
                <form noValidate onSubmit={(event) => event.preventDefault()}>
                  <Field error={codeError} htmlFor="manage-2fa-code" label="Code or recovery code" required>
                    <input
                      autoComplete="one-time-code"
                      className="input tracking-[0.12em]"
                      id="manage-2fa-code"
                      inputMode="text"
                      maxLength={19}
                      onChange={(event) => {
                        setManageCode(event.target.value.toUpperCase());
                        setCodeError(undefined);
                      }}
                      placeholder="123456"
                      value={manageCode}
                    />
                  </Field>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Btn loading={pending === "recoveries"} loadingLabel="Generating" onClick={() => void regenerateRecoveryCodes()} variant="secondary">
                      Generate new recovery codes
                    </Btn>
                    <Btn loading={pending === "disable"} loadingLabel="Disabling" onClick={() => void disableTwoFactor()} variant="danger">
                      Disable 2FA
                    </Btn>
                  </div>
                </form>
              </section>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
