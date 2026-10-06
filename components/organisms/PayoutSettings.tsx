"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { describeRequirement } from "@/features/payments/schemas";
import { usePayoutAccount } from "@/features/payments/use-payments";
import { queryKeys } from "@/lib/query/keys";

import { Btn, Tag } from "../atoms";
import { SectionLoader } from "../molecules";
import { StripePayoutComponents } from "./StripePayoutComponents";

type PayoutSettingsProps = {
  /** Open the setup form straight away, for example when a hosted Stripe link expired. */
  openSetup?: boolean;
  returnedFromStripe?: boolean;
};

/**
 * The teacher's payout setup, bank account and payouts, all inside SupplyEd:
 * Stripe's embedded forms collect the details, which go straight to Stripe.
 * Render only for the signed-in instructor; the payout endpoints also enforce that role.
 */
export function PayoutSettings({ openSetup = false, returnedFromStripe = false }: PayoutSettingsProps) {
  const queryClient = useQueryClient();
  const [panel, setPanel] = useState<"payouts" | "setup" | null>(openSetup ? "setup" : null);
  const [checking, setChecking] = useState(returnedFromStripe);
  const payoutQuery = usePayoutAccount({ pollUntilReady: checking });
  const account = payoutQuery.data;
  const missing = [...new Set((account?.requirementsDue ?? []).map(describeRequirement))];
  const needsDetails = Boolean(account && (!account.ready || !account.detailsSubmitted));

  function finishSetup() {
    setPanel(null);
    setChecking(true);
    void queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
  }

  return (
    <section aria-labelledby="payout-settings-heading" className="card card-pad-lg">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-2xl leading-tight" id="payout-settings-heading">Payouts</h2>
            {account ? (
              <Tag tone={account.ready ? "green" : account.connected ? "amber" : "ghost"}>
                {account.ready ? "Ready to receive payments" : account.connected ? "Setup in progress" : "Not set up"}
              </Tag>
            ) : null}
          </div>
          <p className="mt-2 max-w-[660px] text-sm leading-6 text-muted">
            {account?.ready
              ? "You're set up to be paid. Schools' payments for your bookings go straight to your bank account."
              : "Takes about 2 minutes, right here: your date of birth, your bank account, and accepting the terms of Stripe, our payments partner. We fill in the rest from your profile. Your bank details go straight to Stripe; SupplyEd never stores them."}
          </p>
        </div>
        {account && !payoutQuery.isError ? (
          <div className="flex flex-wrap gap-2">
            {needsDetails && panel !== "setup" ? (
              <Btn onClick={() => setPanel("setup")}>{account.connected ? "Continue setup" : "Set up payouts"}</Btn>
            ) : null}
            {account.ready ? (
              <Btn variant="secondary" onClick={() => setPanel(panel === "payouts" ? null : "payouts")}>
                {panel === "payouts" ? "Hide bank account and payouts" : "Bank account and payouts"}
              </Btn>
            ) : null}
            {panel ? null : (
              <Btn loading={payoutQuery.isFetching} loadingLabel="Checking" onClick={() => void payoutQuery.refetch()} variant="ghost">
                Refresh status
              </Btn>
            )}
          </div>
        ) : null}
      </div>

      {payoutQuery.isLoading ? <div className="mt-5"><SectionLoader rows={2} /></div> : null}
      {payoutQuery.isError || (!payoutQuery.isLoading && !account) ? (
        <div className="mt-4 rounded-lg border border-danger bg-danger-tint px-4 py-3 text-sm" role="alert">
          <p className="text-danger">{payoutQuery.error instanceof Error ? payoutQuery.error.message : "Payout status could not be loaded."}</p>
          <div className="mt-3">
            <Btn loading={payoutQuery.isFetching} loadingLabel="Checking" onClick={() => void payoutQuery.refetch()} size="sm" variant="secondary">
              Try again
            </Btn>
          </div>
        </div>
      ) : null}

      {account && !payoutQuery.isError && !panel ? (
        <>
          {checking && !account.ready ? (
            <p className="mt-4 text-sm leading-6 text-muted" role="status">
              Thanks. Stripe is checking your details; this usually takes under a minute and this page updates by itself.
            </p>
          ) : null}
          {account.connected ? (
            <div className="mt-5 grid gap-3 rounded-lg border border-border bg-chalk p-4 sm:grid-cols-3">
              <PayoutStatus label="Account details" complete={account.detailsSubmitted} completeLabel="Submitted" />
              <PayoutStatus label="Payments" complete={account.chargesEnabled} completeLabel="Enabled" />
              <PayoutStatus label="Bank payouts" complete={account.payoutsEnabled} completeLabel="Enabled" />
            </div>
          ) : null}
          {needsDetails && account.connected && missing.length > 0 ? (
            <div className="mt-4">
              <p className="text-sm font-semibold text-ink">Still needed</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {missing.map((requirement) => <li key={requirement}><Tag tone="ghost">{requirement}</Tag></li>)}
              </ul>
            </div>
          ) : null}
          {!account.ready && account.disabledReason ? (
            <p className="mt-4 text-sm leading-6 text-warning">
              {account.disabledReason.includes("pending_verification")
                ? "Stripe is reviewing your information. This page updates when it's done."
                : "Stripe needs your attention before it can enable payments. Continue setup to see what's needed."}
            </p>
          ) : null}
        </>
      ) : null}

      {panel ? (
        <div className="mt-5 border-t border-border pt-5">
          <StripePayoutComponents view={panel} onExit={finishSetup} />
          {panel === "setup" ? (
            <div className="mt-4 flex justify-end">
              <Btn size="sm" variant="ghost" onClick={finishSetup}>Finish later</Btn>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function PayoutStatus({ complete, completeLabel, label }: { complete: boolean; completeLabel: string; label: string }) {
  return <div>
    <div className="mb-1 text-xs text-muted">{label}</div>
    <Tag tone={complete ? "green" : "amber"}>{complete ? completeLabel : "Pending"}</Tag>
  </div>;
}
