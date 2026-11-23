"use client";

import { useWorkspaceAccount } from "@/features/auth/workspace-account";
import { usePaymentSetup } from "@/features/payments/payment-setup";
import { Btn, Icon, buttonClassName } from "../atoms";

export function PaymentSetupNotice({ compact = false }: { compact?: boolean }) {
  const { role } = useWorkspaceAccount();
  const setup = usePaymentSetup();
  if (setup.ready) return null;
  const school = role === "institution";
  const unavailable = setup.state === "unavailable";
  const checking = setup.state === "checking";
  const title = checking ? "Checking payment setup…" : unavailable ? "We couldn’t check your payment setup" : school ? "Connect a card before posting jobs" : "Set up bank payouts before applying";
  const detail = checking ? "Please wait while we check your account." : unavailable ? "Try again to confirm whether your account is ready. Posting, invitations and applications need a verified payment setup." : school
    ? "Add a debit or credit card in Settings to create or publish jobs and invite teachers. Messaging, browsing and other settings remain available."
    : "Finish your Stripe bank payout setup to apply for jobs or accept invitations. You can still browse every available job, message schools and use your settings.";
  return <section aria-label="Payment setup" className={`${compact ? "my-3" : "mx-4 mt-6 sm:mx-8"} rounded-2xl border border-brand/25 bg-brand-tint p-4 sm:p-5`}>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="rounded-xl bg-surface p-2 text-brand" aria-hidden="true"><Icon name="pound" size={22} /></span>
        <div role="status"><h2 className="font-heading text-base font-semibold text-ink">{title}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate">{detail}</p>
          {setup.state === "required" && school && setup.setupStatus === "PENDING" ? <p className="mt-1 text-sm text-muted">Finish saving your card, then check again.</p> : null}
          {setup.state === "required" && school && setup.setupStatus === "FAILED" ? <p className="mt-1 text-sm text-muted">The last setup attempt did not complete. Please try again.</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!checking && !unavailable ? <a className={buttonClassName({ size: "sm" })} href={school ? "/settings#school-payment-settings" : "/settings#payout-settings"} target="_blank" rel="noopener noreferrer">{school ? "Connect card" : "Set up bank payouts"}<span className="sr-only"> (opens in a new tab, keeping your draft here)</span></a> : null}
        <Btn size="sm" variant="secondary" disabled={setup.refreshing} onClick={setup.refresh}>{setup.refreshing ? "Checking…" : unavailable ? "Retry payment check" : "Check again"}</Btn>
      </div>
    </div>
    {!checking && !unavailable ? <p className="mt-3 text-xs text-muted">Setup opens in a new tab so your work stays here. Return and check again when finished.</p> : null}
  </section>;
}
