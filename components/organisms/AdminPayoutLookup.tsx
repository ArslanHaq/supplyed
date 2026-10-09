"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { describeRequirement } from "@/features/payments/schemas";
import type { PayoutAccount } from "@/features/payments/types";
import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";

import { Btn, Field, Tag } from "../atoms";

export function AdminPayoutLookup() {
  const [input, setInput] = useState("");
  const [instructorId, setInstructorId] = useState("");
  const [inputError, setInputError] = useState<string>();
  const payoutQuery = useQuery({
    enabled: Boolean(instructorId),
    queryFn: () => fetchJson<PayoutAccount>(`/api/payments/payout-accounts/instructor/${encodeURIComponent(instructorId)}`),
    queryKey: [...queryKeys.payments.all, "instructor-payout-account", instructorId],
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    staleTime: 0,
  });
  const account = payoutQuery.data;
  const missing = [...new Set((account?.requirementsDue ?? []).map(describeRequirement))];

  function lookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = input.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      setInputError("Enter the instructor profile ID as a valid UUID.");
      return;
    }
    setInputError(undefined);
    if (id === instructorId) void payoutQuery.refetch();
    else setInstructorId(id);
  }

  return (
    <section aria-labelledby="admin-payout-heading" className="admin-payout-lookup card card-pad-lg mb-6">
      <h2 className="font-heading text-2xl" id="admin-payout-heading">Instructor payout status</h2>
      <p className="mt-2 text-sm leading-6 text-muted">Check whether an instructor can receive Stripe payments before issuing an invoice or helping with payout setup.</p>
      <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start" noValidate onSubmit={lookup}>
        <div className="flex-1">
          <Field error={inputError} hint="Use the instructor profile ID from the booking or invoice." label="Instructor profile ID" required>
            <input className="input" onChange={(event) => { setInput(event.target.value); setInputError(undefined); }} placeholder="00000000-0000-0000-0000-000000000000" value={input} />
          </Field>
        </div>
        <Btn className="sm:mt-6" loading={payoutQuery.isFetching} loadingLabel="Checking" type="submit" variant="secondary">Check status</Btn>
      </form>
      {payoutQuery.isError ? <div className="mt-4 rounded-lg bg-danger-tint px-4 py-3 text-sm text-danger" role="alert">
        <p>{payoutQuery.error.message}</p>
        <Btn className="mt-3" loading={payoutQuery.isFetching} loadingLabel="Checking" onClick={() => void payoutQuery.refetch()} size="sm" variant="secondary">Try again</Btn>
      </div> : null}
      {account && !payoutQuery.isError ? <div className="mt-4 rounded-lg border border-border bg-chalk p-4" role="status">
        <p className="mb-3 break-all text-xs text-muted">Instructor profile: {instructorId}</p>
        <div className="flex flex-wrap gap-2">
          <Tag tone={account.ready ? "green" : account.connected ? "amber" : "ghost"}>{account.ready ? "Ready for invoices" : account.connected ? "Setup incomplete" : "Payouts not set up"}</Tag>
          <Tag tone={account.chargesEnabled ? "green" : "amber"}>Payments {account.chargesEnabled ? "enabled" : "pending"}</Tag>
          <Tag tone={account.payoutsEnabled ? "green" : "amber"}>Bank payouts {account.payoutsEnabled ? "enabled" : "pending"}</Tag>
          <Tag tone={account.detailsSubmitted ? "green" : "ghost"}>Details {account.detailsSubmitted ? "submitted" : "required"}</Tag>
        </div>
        {!account.ready ? <p className="mt-3 text-sm text-muted">The instructor must finish payout setup from their account settings before this booking can be invoiced.</p> : null}
        {missing.length > 0 ? <p className="mt-3 text-sm text-muted">Required: {missing.join(", ")}.</p> : null}
        {account.disabledReason ? <p className="mt-3 break-words text-xs text-muted">Stripe account restriction: {account.disabledReason.replaceAll("_", " ").replaceAll(".", " — ")}</p> : null}
      </div> : null}
    </section>
  );
}
