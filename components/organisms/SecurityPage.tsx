"use client";

import Image from "next/image";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import {
  disableTwoFactorAction,
  enableTwoFactorAction,
  getTwoFactorStatusAction,
  regenerateTwoFactorRecoveryCodesAction,
  startTwoFactorSetupAction,
} from "@/features/auth/two-factor-actions";
import { queryKeys } from "@/lib/query/keys";
import type { SettingsProfileSnapshot } from "@/features/settings/types";
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
  const queryClient = useQueryClient();

  function syncSettingsStatus(enabled: boolean) {
    queryClient.setQueryData<SettingsProfileSnapshot>(
      queryKeys.settings.profile(),
      (current) => current
        ? { ...current, user: { ...current.user, twoFactorEnabled: enabled } }
        : current,
    );
    return queryClient.invalidateQueries({ queryKey: queryKeys.settings.profile() });
  }

  const [status, setStatus] = useState<TwoFactorStatus>();
  const [setup, setSetup] = useState<TwoFactorSetup>();
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [enableCode, setEnableCode] = useState("");
  const [manageCode, setManageCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [disableError, setDisableError] = useState<string>();
  const [showDisableForm, setShowDisableForm] = useState(false);
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
      queryClient.setQueryData<SettingsProfileSnapshot>(queryKeys.settings.profile(), (current) => current ? { ...current, user: { ...current.user, twoFactorEnabled: result.data.enabled } } : current);
      setPending(null);
    }

    void loadStatus();

    return () => {
      mounted = false;
    };
  }, [toast, queryClient]);

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
    await syncSettingsStatus(true);
    toast({ title: "Two-factor enabled", msg: "Save your recovery codes before leaving this page.", tone: "success" });
    setPending(null);
  }

  async function disableTwoFactor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("disable");
    setDisableError(undefined);
    const result = await disableTwoFactorAction(null, formData({ code: disableCode }));

    if (!result.ok) {
      setDisableError(result.fieldErrors?.code ?? result.message);
      toast({ title: "Could not disable 2FA", msg: result.message, tone: "danger" });
      setPending(null);
      return;
    }

    setStatus({ enabled: false, recoveryCodesRemaining: 0, setupPending: false });
    setDisableCode("");
    setShowDisableForm(false);
    setRecoveryCodes([]);
    await syncSettingsStatus(false);
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

  function downloadRecoveryCodes() {
    if (recoveryCodes.length === 0) return;

    const fileContent = [
      "SupplyED recovery codes",
      "Store these somewhere private and offline. Each code can be used once.",
      "",
      ...recoveryCodes,
      "",
    ].join("\n");
    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "supplyed-recovery-codes.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    toast({ title: "Recovery codes downloaded", msg: "Keep the file somewhere private and offline.", tone: "success" });
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
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-5">
            <section className="card overflow-hidden">
              <div className="border-b border-border bg-[linear-gradient(135deg,#fff_0%,#f6fbf8_55%,rgb(var(--se-rgb)/0.10)_100%)] px-5 py-5 sm:px-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-tint text-brand">
                      <Icon name="shield" size={24} />
                    </span>
                    <div>
                      <div className="section-title mb-1">Two-factor authentication</div>
                      <p className="max-w-[620px] text-sm leading-6 text-muted">
                        Add an authenticator app so password sign-in always needs a second code.
                      </p>
                    </div>
                  </div>
                  <Tag tone={status?.enabled ? "green" : status?.setupPending ? "amber" : "ghost"}>{statusLabel(status)}</Tag>
                </div>
              </div>

              <div className="card-pad-lg">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-border bg-chalk p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Sign-in protection</div>
                    <div className="mt-2 font-serif text-2xl text-ink">{status?.enabled ? "Active" : "Not active"}</div>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {status?.enabled
                        ? "Login requires an authenticator code or an unused recovery code."
                        : "Start setup, scan the QR code, then confirm the first authenticator code."}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-chalk p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Recovery codes</div>
                    <div className="mt-2 font-serif text-2xl text-ink">{status?.recoveryCodesRemaining ?? 0}</div>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      Backup codes let you regain access if your authenticator device is unavailable.
                    </p>
                  </div>
                </div>

                {!status?.enabled ? (
                  <Btn className="mt-5" icon="shield" loading={pending === "setup"} loadingLabel="Starting setup" onClick={startSetup}>
                    {setup ? "Restart authenticator setup" : "Set up authenticator"}
                  </Btn>
                ) : null}
              </div>
            </section>

            {setup ? (
              <section className="card card-pad-lg">
                <div className="mb-5 flex items-start gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-tint text-brand">
                    <Icon name="lock" size={22} />
                  </span>
                  <div>
                    <div className="section-title mb-1">Connect your authenticator app</div>
                    <p className="text-sm leading-6 text-muted">
                      Scan the QR code, or use the manual setup key, then enter the 6-digit code from your app.
                    </p>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="rounded-xl border border-border bg-white p-4 shadow-(--shadow-xs)">
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

          <aside className="min-w-0 space-y-5">
            <section className="card card-pad-lg">
              <div className="mb-5 flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-tint text-brand">
                  <Icon name="file" size={22} />
                </span>
                <div>
                  <div className="section-title mb-1">Recovery codes</div>
                  <p className="text-sm leading-6 text-muted">Save the one-time backup keys somewhere private.</p>
                </div>
              </div>

              {recoveryCodes.length > 0 ? (
                <div className="rounded-xl border border-warning/30 bg-warning-tint p-4">
                  <div className="mb-3 text-sm font-semibold text-warning">Save these now. They are shown only once.</div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                    {recoveryCodes.map((code) => (
                      <code key={code} className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-ink">
                        {code}
                      </code>
                    ))}
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                    <Btn onClick={() => void copyRecoveryCodes()} variant="secondary">
                      Copy codes
                    </Btn>
                    <Btn icon="download" onClick={downloadRecoveryCodes}>
                      Download .txt
                    </Btn>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-chalk p-4 text-sm leading-6 text-muted">
                  New recovery codes appear here immediately after enabling 2FA or generating a fresh set.
                </div>
              )}
            </section>

            {status?.enabled ? (
              <section className="card card-pad-lg">
                <div className="mb-4 flex items-start gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-tint text-brand">
                    <Icon name="settings" size={22} />
                  </span>
                  <div>
                    <div className="section-title mb-1">Manage 2FA</div>
                    <p className="text-sm leading-6 text-muted">
                      Enter a current authenticator code or one recovery code before changing settings.
                    </p>
                  </div>
                </div>
                <div>
                  <Field error={codeError} htmlFor="manage-2fa-code" label="Code for new recovery codes" required>
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
                    {!showDisableForm ? (
                      <Btn onClick={() => { setDisableError(undefined); setShowDisableForm(true); }} variant="danger">
                        Disable 2FA
                      </Btn>
                    ) : null}
                  </div>
                </div>
                {showDisableForm ? (
                  <form className="mt-5 rounded-xl border border-danger/30 bg-danger-tint p-4" noValidate onSubmit={(event) => void disableTwoFactor(event)}>
                    <div className="mb-3 font-semibold text-danger">Confirm disabling 2FA</div>
                    <Field
                      error={disableError}
                      hint="Use a new authenticator code or an unused recovery code."
                      htmlFor="disable-2fa-code"
                      label="Authenticator or recovery code"
                      required
                    >
                      <input
                        autoComplete="one-time-code"
                        autoFocus
                        className="input"
                        id="disable-2fa-code"
                        inputMode="text"
                        maxLength={19}
                        onChange={(event) => { setDisableCode(event.target.value.toUpperCase()); setDisableError(undefined); }}
                        placeholder="Enter your code"
                        value={disableCode}
                      />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <Btn loading={pending === "disable"} loadingLabel="Disabling" type="submit" variant="danger">
                        Confirm disable
                      </Btn>
                      <Btn disabled={pending === "disable"} onClick={() => { setShowDisableForm(false); setDisableCode(""); setDisableError(undefined); }} variant="secondary">
                        Cancel
                      </Btn>
                    </div>
                  </form>
                ) : null}
              </section>
            ) : null}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
