"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import {
  useCreateSchoolBillingSetup,
  useRemoveSchoolPaymentMethod,
  useSchoolBillingSettings,
  useSyncSchoolBillingSetup,
  useUpdateSchoolAutomaticPayments,
} from "@/features/payments/use-payments";
import type { SchoolBillingSettings } from "@/features/payments/types";
import { automaticPaymentPhase, requiresCardAuthentication } from "@/features/payments/payment-status";
import type { ToastFn } from "@/types/supplyed";

import { Btn, Checkbox, Tag } from "../atoms";
import { Modal, SectionLoader } from "../molecules";

export function SchoolBillingSettingsCard({ toast }: { toast: ToastFn }) {
  const settingsQuery = useSchoolBillingSettings();
  const switchId = useId();
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [setupConsent, setSetupConsent] = useState(false);
  const setup = useCreateSchoolBillingSetup({
    onError: () => toast({ title: "Setup unavailable", msg: "Payment method setup could not be started. Please try again.", tone: "danger" }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast({ title: "Setup unavailable", msg: result.message, tone: "danger" });
        return;
      }
      window.location.assign(result.data.url);
    },
  });
  const update = useUpdateSchoolAutomaticPayments({
    onError: () => {
      setUpdateError("Automatic payment settings could not be updated. Please try again.");
      toast({ title: "Setting not saved", msg: "Automatic payment settings could not be updated.", tone: "danger" });
    },
    onSuccess: (result) => {
      toast({ title: result.ok ? "Billing preference saved" : "Setting not saved", msg: result.message ?? (result.ok ? "Your billing preference was updated." : "Automatic payment settings could not be updated."), tone: result.ok ? "success" : "danger" });
      setUpdateError(result.ok ? null : result.message || "Automatic payment settings could not be updated.");
      if (result.ok) setConsent(false);
    },
  });
  const remove = useRemoveSchoolPaymentMethod({
    onError: () => toast({ title: "Payment method not removed", msg: "Please try again.", tone: "danger" }),
    onSuccess: (result) => {
      toast({ title: result.ok ? "Payment method removed" : "Payment method not removed", msg: result.message ?? (result.ok ? "The saved payment method was removed." : "Please try again."), tone: result.ok ? "success" : "danger" });
      if (result.ok) setRemoveOpen(false);
    },
  });

  useSchoolBillingSetupReturn(toast);

  const settings = settingsQuery.data;
  const hasCard = settings?.paymentMethod?.type === "card";
  const legacyMethod = Boolean(settings?.paymentMethod && !hasCard);
  const busy = setup.isPending || update.isPending || remove.isPending;
  const currentPaymentPhase = settings?.currentPayment
    ? automaticPaymentPhase({
        failureMessage: settings.currentPayment.failureMessage,
        nextAttemptAt: settings.currentPayment.nextAttemptAt,
        paymentAttemptCount: settings.currentPayment.paymentAttemptCount,
        status: settings.currentPayment.status,
      })
    : null;

  return (
    <>
      <section className="card card-pad-lg mb-6" aria-labelledby="automatic-billing-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-xl" id="automatic-billing-title">Automatic payments</h2>
              {settings ? <BillingStatus settings={settings} /> : null}
            </div>
            <p className="mt-2 text-sm leading-6 text-muted">
              Add a card securely on Stripe and authorise automatic booking payments once. SupplyED will charge it when each booking payment becomes due, without asking you to release funds each time.
            </p>
          </div>
        </div>

        {settingsQuery.isLoading ? <div className="mt-5"><SectionLoader rows={2} /></div> : null}
        {settingsQuery.error ? <div className="mt-5 rounded-xl border border-warning/20 bg-warning-tint p-4 text-sm" role="alert"><p>{settingsQuery.error.message}</p><button type="button" className="mt-2 font-semibold underline" onClick={() => void settingsQuery.refetch()}>Try again</button></div> : null}

        {settings ? <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-border p-4">
            <h3 className="font-semibold text-ink">{hasCard ? "Replace your saved card" : "Set up automatic card payments"}</h3>
            <p className="mt-2 text-xs leading-5 text-muted">Card number and security code are entered on Stripe&apos;s secure page and sent directly to Stripe. SupplyED stores Stripe references and masked card details only. No booking payment is taken during card setup.</p>
            <div className="mt-4 rounded-lg bg-chalk p-3">
              <Checkbox
                checked={setupConsent}
                disabled={busy}
                label={<span><strong className="text-ink">I authorise SupplyED to save my card with Stripe and charge eligible booking payments automatically.</strong><span className="mt-1 block text-xs leading-5 text-muted">Payments follow each booking&apos;s agreed schedule: daily, weekly, monthly or on completion. The amount is payable teacher earnings plus the displayed SupplyED fee. Absences are excluded where attendance determines pay. I can turn off future automatic payments in Billing.</span></span>}
                onChange={setSetupConsent}
              />
            </div>
            <Btn className="mt-4" loading={setup.isPending} loadingLabel="Opening Stripe" disabled={busy || !setupConsent} variant={hasCard ? "secondary" : "primary"} onClick={() => setup.mutate({ consentToTerms: true })}>
              {hasCard ? "Replace card securely" : legacyMethod ? "Replace with a card" : "Add card and enable automatic payments"}
            </Btn>
          </div>

          <div className="rounded-xl border border-border bg-chalk p-4">
            {settings.paymentMethod ? <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{settings.paymentMethod.label}</p>
                <p className="mt-1 text-xs text-muted">{paymentMethodDescription(settings)}</p>
              </div>
              <Btn disabled={busy} size="sm" variant="ghost" onClick={() => setRemoveOpen(true)}>Remove</Btn>
            </div> : <div><p className="font-semibold text-ink">No saved card</p><p className="mt-1 text-sm text-muted">Add and authorise a card above to start automatic booking payments.</p></div>}
          </div>

          {legacyMethod ? <p className="rounded-xl border border-warning/20 bg-warning-tint p-4 text-sm" role="status">Replace your previous payment method with a card to continue automatic payments. Payments already submitted will keep their existing Stripe status.</p> : null}

          {settings.lastSetupError ? <p className="rounded-xl border border-warning/20 bg-warning-tint p-4 text-sm text-warning" role="alert">{settings.lastSetupError}</p> : null}

          <div className="rounded-xl border border-border p-4">
            <h3 className="font-semibold text-ink">Booking-payment automation</h3>
            <p className="mt-2 text-xs leading-5 text-muted">When an eligible booking payment becomes due, SupplyED automatically charges your saved card through Stripe. You do not need to approve each invoice or release each payment. A failed charge or a bank security check may need your attention in Billing. Stripe balance availability and the teacher&apos;s bank payout happen separately.</p>
            {!settings.automaticPaymentsEnabled && hasCard ? <div className="mt-4 rounded-lg bg-chalk p-3">
              <Checkbox
                checked={consent}
                disabled={busy || !settings.canEnableAutomaticPayments}
                label={<span><strong className="text-ink">I authorise automatic charges to my saved card</strong><span className="mt-1 block text-xs leading-5 text-muted">Payments follow each booking&apos;s agreed schedule and include payable teacher earnings plus the displayed SupplyED fee. I can turn off future automatic payments here.</span></span>}
                onChange={setConsent}
              />
            </div> : null}
            <div className="mt-4 flex items-center justify-between gap-4 rounded-lg bg-chalk p-4">
              <div>
                <p id={`${switchId}-label`} className="font-semibold text-ink">Enable automatic payments</p>
                <p id={`${switchId}-description`} className="mt-1 text-xs leading-5 text-muted">
                  {settings.automaticPaymentsEnabled
                    ? "On — eligible booking payments are charged to your saved card."
                    : "Off — pay eligible unpaid bookings manually from Bookings or Billing."}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm font-semibold" aria-live="polite">{update.isPending ? "Saving…" : settings.automaticPaymentsEnabled ? "On" : "Off"}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.automaticPaymentsEnabled}
                  aria-labelledby={`${switchId}-label`}
                  aria-describedby={`${switchId}-description`}
                  aria-busy={update.isPending}
                  disabled={busy || (!settings.automaticPaymentsEnabled && (!hasCard || !settings.canEnableAutomaticPayments || !consent))}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50 ${settings.automaticPaymentsEnabled ? "bg-brand" : "bg-slate-400"}`}
                  onClick={() => {
                    setUpdateError(null);
                    update.mutate(settings.automaticPaymentsEnabled
                      ? { automaticPaymentsEnabled: false }
                      : { automaticPaymentsEnabled: true, consentToTerms: true });
                  }}
                >
                  <span aria-hidden="true" className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${settings.automaticPaymentsEnabled ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
            </div>
            {!settings.automaticPaymentsEnabled && hasCard && settings.canEnableAutomaticPayments && !consent ? <p className="mt-2 text-xs text-muted">Confirm the authorisation above to turn automatic payments on.</p> : null}
            {updateError ? <p className="mt-3 text-sm text-danger" role="alert">{updateError}</p> : null}
            {!settings.canEnableAutomaticPayments && !settings.automaticPaymentsEnabled ? <p className="mt-3 text-xs text-muted">Complete card setup above to enable automatic payments.</p> : null}
            {settings.consentedAt && settings.consentTermsVersion ? <p className="mt-3 text-xs text-muted">Latest authorisation: {formatDateTime(settings.consentedAt)} · terms {settings.consentTermsVersion}</p> : null}
          </div>

          {settings.stripeSyncStatus !== "SYNCED" ? <p className="rounded-xl border border-warning/20 bg-warning-tint p-4 text-sm text-warning" role="status">New automatic submissions are blocked locally. Stripe-side collection is {settings.stripeSyncStatus === "FAILED" ? "waiting for reconciliation" : "being paused"}.{settings.stripeSyncError ? ` ${settings.stripeSyncError}` : ""}</p> : null}

          {settings.currentPayment ? <div className="rounded-xl border border-border p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><strong>Current automatic payment</strong><Tag tone={settings.currentPayment.failureMessage ? "red" : "amber"}>{requiresCardAuthentication(settings.currentPayment.failureCode) ? "Card approval required" : settings.currentPayment.failureMessage ? "Needs attention" : currentPaymentPhase === "scheduled" ? "Scheduled" : "Processing"}</Tag></div>
            {settings.currentPayment.jobTitle ? <p className="mt-2 font-semibold">Booking: {settings.currentPayment.jobTitle}</p> : null}
            {settings.currentPayment.bookingId ? <a className="mt-1 inline-block text-brand underline underline-offset-2" href={`/bookings?bookingId=${encodeURIComponent(settings.currentPayment.bookingId)}`}>View this booking</a> : null}
            <p className="mt-2 text-muted">{formatPence(settings.currentPayment.totalAmountPence)} · {settings.currentPayment.failureMessage ?? (currentPaymentPhase === "scheduled" ? `Stripe will charge this automatically${settings.currentPayment.nextAttemptAt ? ` on ${formatDateTime(settings.currentPayment.nextAttemptAt)}` : ""}. No release or approval is needed.` : "Payment is processing. This page updates when Stripe confirms the result.")}</p>
            {settings.currentPayment.nextAttemptAt ? <p className="mt-1 text-xs text-muted">Next provider attempt: {formatDateTime(settings.currentPayment.nextAttemptAt)}</p> : null}
          </div> : <p className="rounded-xl border border-border p-4 text-sm text-muted">No automatic payment is currently processing. The next charge is created when an eligible booking payment becomes due.</p>}

          <p className="text-xs leading-5 text-muted">Automatic charges support attendance-based hourly, daily, weekly and monthly payments, fixed work payable on completion, and completed bookings with no attendance decisions. A payment that fails or requires card authentication appears in Billing for recovery. Turning automation off does not cancel an amount owed or reverse a payment already submitted.</p>
        </div> : null}
      </section>

      <Modal label="Remove payment method" open={removeOpen} onClose={() => { if (!remove.isPending) setRemoveOpen(false); }}>
        <div className="p-6 sm:p-7">
          <h2 className="font-heading text-2xl">Remove this payment method?</h2>
          <p className="mt-3 text-sm leading-6 text-muted">Automatic payments will be turned off before the saved method is removed. Payments already submitted may continue processing. Unpaid booking amounts will still be shown in Billing.</p>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Btn disabled={remove.isPending} variant="ghost" onClick={() => setRemoveOpen(false)}>Keep method</Btn>
            <Btn loading={remove.isPending} loadingLabel="Removing" variant="danger" onClick={() => remove.mutate()}>Remove payment method</Btn>
          </div>
        </div>
      </Modal>
    </>
  );
}

function BillingStatus({ settings }: { settings: SchoolBillingSettings }) {
  if (settings.paymentMethod && settings.paymentMethod.type !== "card") return <Tag tone="amber">Replace with a card</Tag>;
  if (settings.paymentMethod?.type === "card" && settings.automaticPaymentsEnabled && settings.canEnableAutomaticPayments) return <Tag tone="green">Automatic payments on</Tag>;
  if (settings.setupStatus === "PENDING") return <Tag tone="amber">Setup processing</Tag>;
  if (settings.setupStatus === "FAILED") return <Tag tone="red">Payment method needs attention</Tag>;
  if (settings.canEnableAutomaticPayments) return <Tag tone="ghost">Ready to enable</Tag>;
  return <Tag tone="ghost">Not set up</Tag>;
}

function paymentMethodDescription(settings: SchoolBillingSettings) {
  const method = settings.paymentMethod;
  if (!method) return "";
  if (method.type === "card") return "Saved securely by Stripe for automatic booking payments.";
  return "Previous payment method. Add a card above to use automatic card payments.";
}

function useSchoolBillingSetupReturn(toast: ToastFn) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const handled = useRef(false);
  const sync = useSyncSchoolBillingSetup({
    onError: () => toast({ title: "Setup status unavailable", msg: "Refresh Billing to check the saved payment method.", tone: "danger" }),
    onSuccess: (result) => toast({ title: result.ok ? "Card setup updated" : "Setup not completed", msg: result.message ?? (result.ok ? "Refresh Billing for your automatic payment status." : "Refresh Billing and try setup again."), tone: result.ok ? "success" : "danger" }),
  });
  const mutate = sync.mutate;
  const setup = searchParams.get("setup");
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    if (handled.current || !setup) return;
    handled.current = true;
    router.replace(pathname, { scroll: false });
    if (setup === "cancelled") {
      toast({ title: "Setup cancelled", msg: "No payment method was changed." });
      return;
    }
    if (setup === "success" && sessionId) mutate(sessionId);
    else toast({ title: "Setup not completed", msg: "The payment setup reference is missing. Start setup again.", tone: "danger" });
  }, [mutate, pathname, router, sessionId, setup, toast]);
}

function formatPence(value: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value / 100);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
