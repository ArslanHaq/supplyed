"use client";

import { useEffect, useRef, useState } from "react";

import { describeRequirement } from "@/features/payments/schemas";
import { isStripePayoutUrl } from "@/features/payments/stripe-links";
import { usePayoutAccount, usePayoutLink } from "@/features/payments/use-payments";

import { Btn, buttonClassName, Tag } from "../atoms";
import { SectionLoader } from "../molecules";

type PayoutSettingsProps = {
  resumeExpiredLink?: boolean;
  returnedFromStripe?: boolean;
};

/** Render only for the signed-in instructor; the payout endpoints also enforce that role. */
export function PayoutSettings({ resumeExpiredLink = false, returnedFromStripe = false }: PayoutSettingsProps) {
  const payoutQuery = usePayoutAccount({ pollUntilReady: returnedFromStripe });
  const [linkError, setLinkError] = useState<string>();
  const resumed = useRef(false);
  const onFailure = (result: { ok: boolean; message?: string; requestId?: string }) => {
    if (!result.ok) {
      setLinkError(`${result.message ?? "Payout setup could not be opened. Please try again."}${result.requestId ? ` Support reference: ${result.requestId}` : ""}`);
    }
  };
  const onNavigationFailure = () => setLinkError("Stripe could not be opened automatically. Try again or use Open Stripe below.");
  const onboarding = usePayoutLink("onboarding", { onError: onNavigationFailure, onSuccess: onFailure });
  const dashboard = usePayoutLink("dashboard", { onError: onNavigationFailure, onSuccess: onFailure });
  const resumeOnboarding = onboarding.mutate;

  useEffect(() => {
    if (resumeExpiredLink && !resumed.current) {
      resumed.current = true;
      resumeOnboarding();
    }
  }, [resumeExpiredLink, resumeOnboarding]);

  const account = payoutQuery.data;
  const missing = [...new Set((account?.requirementsDue ?? []).map(describeRequirement))];
  const linkResult = account?.ready ? dashboard.data : onboarding.data;
  const stripeUrl = linkResult?.ok && isStripePayoutUrl(linkResult.data.url) ? linkResult.data.url : undefined;
  const opening = onboarding.isPending || dashboard.isPending;

  function openSetup() {
    setLinkError(undefined);
    onboarding.mutate();
  }

  function openDashboard() {
    setLinkError(undefined);
    dashboard.mutate();
  }

  return (
    <section aria-labelledby="payout-settings-heading" className="card card-pad-lg">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-2xl leading-tight" id="payout-settings-heading">Payouts</h2>
            {account ? <Tag tone={account.ready ? "green" : account.connected ? "amber" : "ghost"}>
              {account.ready ? "Ready to receive payments" : account.connected ? "Setup in progress" : "Not set up"}
            </Tag> : null}
          </div>
          <p className="mt-2 max-w-[660px] text-sm leading-6 text-muted">
            Add or manage your bank account securely through Stripe so schools can pay for your completed bookings.
          </p>
        </div>
        {account && !payoutQuery.isError ? (
          <div className="flex flex-wrap gap-2">
            {account.ready ? (
              <Btn disabled={opening} loading={dashboard.isPending} loadingLabel="Opening Stripe" onClick={openDashboard} variant="secondary">
                Manage payouts
              </Btn>
            ) : (
              <Btn disabled={opening} loading={onboarding.isPending} loadingLabel="Opening Stripe" onClick={openSetup}>
                {account.connected ? "Continue payout setup" : "Set up payouts"}
              </Btn>
            )}
            <Btn disabled={opening} loading={payoutQuery.isFetching} loadingLabel="Checking" onClick={() => void payoutQuery.refetch()} variant="ghost">
              Refresh status
            </Btn>
          </div>
        ) : null}
      </div>

      {payoutQuery.isLoading ? <div className="mt-5"><SectionLoader rows={2} /></div> : null}
      {payoutQuery.isError || (!payoutQuery.isLoading && !account) ? (
        <div className="mt-4 rounded-lg border border-danger bg-danger-tint px-4 py-3 text-sm" role="alert">
          <p className="text-danger">{payoutQuery.error instanceof Error ? payoutQuery.error.message : "Payout status could not be loaded."}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn loading={payoutQuery.isFetching} loadingLabel="Checking" onClick={() => void payoutQuery.refetch()} size="sm" variant="secondary">Try again</Btn>
            {resumeExpiredLink ? <Btn loading={onboarding.isPending} loadingLabel="Opening Stripe" onClick={openSetup} size="sm">Resume payout setup</Btn> : null}
          </div>
        </div>
      ) : null}

      {account && !payoutQuery.isError ? (
        <>
          {returnedFromStripe ? <p className="mt-4 text-sm leading-6 text-muted" role="status">
            {account.ready ? "Your Stripe setup is complete. You can now receive payments for completed bookings." : "Your latest Stripe status is shown below. If Stripe is reviewing your details, this page will check for updates automatically."}
          </p> : null}
          {account.connected ? (
            <div className="mt-5 grid gap-3 rounded-lg border border-border bg-chalk p-4 sm:grid-cols-3">
              <PayoutStatus label="Account details" complete={account.detailsSubmitted} completeLabel="Submitted" />
              <PayoutStatus label="Payments" complete={account.chargesEnabled} completeLabel="Enabled" />
              <PayoutStatus label="Bank payouts" complete={account.payoutsEnabled} completeLabel="Enabled" />
            </div>
          ) : null}
          {!account.ready && missing.length > 0 ? (
            <div className="mt-4">
              <p className="text-sm font-semibold text-ink">Complete these details in Stripe</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {missing.map((requirement) => <li key={requirement}><Tag tone="ghost">{requirement}</Tag></li>)}
              </ul>
            </div>
          ) : null}
          {!account.ready && account.disabledReason ? <p className="mt-4 text-sm leading-6 text-warning">
            {account.disabledReason.includes("pending_verification")
              ? "Stripe is reviewing your information. Check status again shortly."
              : "Stripe needs your attention before it can enable payments. Continue payout setup to review the account requirements."}
          </p> : null}
        </>
      ) : null}

      {linkError ? <p className="mt-4 rounded-lg bg-danger-tint px-4 py-3 text-sm text-danger" role="alert">{linkError}</p> : null}
      {stripeUrl ? <a className={buttonClassName({ className: "mt-3", variant: "secondary" })} href={stripeUrl} rel="noopener noreferrer" target="_top">Open Stripe</a> : null}
    </section>
  );
}

function PayoutStatus({ complete, completeLabel, label }: { complete: boolean; completeLabel: string; label: string }) {
  return <div>
    <div className="mb-1 text-xs text-muted">{label}</div>
    <Tag tone={complete ? "green" : "amber"}>{complete ? completeLabel : "Pending"}</Tag>
  </div>;
}
