"use client";
import { useDropdown } from "@/features/dropdowns/use-dropdown";
import { DropdownStatus } from "@/components/molecules/DynamicDropdown";

import { DynamicSelect } from "@/components/molecules/DynamicDropdown";


import { WorkspaceEmptyState } from "./WorkspacePanels";

import type { ReactNode } from "react";
import { useState } from "react";

import { formatPence } from "@/features/payments/schemas";
import { stripeInvoiceUrl } from "@/features/payments/invoice-links";
import { automaticPaymentPhase, requiresCardAuthentication } from "@/features/payments/payment-status";
import type { AdminInvoiceListQuery, Invoice, InvoiceStatus, PaginatedInvoices, PayableInvoice, RefundReason } from "@/features/payments/types";
import {
  useAllInvoices,
  useInstantPayout,
  useMyInvoices,
  usePayoutAccount,
  usePayoutBalance,
  useRefundInvoice,
  useResendInvoice,
  useSyncInvoice,
  useVoidInvoice,
} from "@/features/payments/use-payments";
import type { AppRole, RouteProps, ToastFn } from "@/types/supplyed";

import { Btn, buttonClassName, Stat, Tag } from "../atoms";
import { Modal, PageHead, SectionLoader } from "../molecules";
import { InvoiceDetailsModal } from "./InvoiceDetailsModal";
import { PayInvoiceModal, usePaymentReturn } from "./PayInvoiceModal";
import { PayoutSettings } from "./PayoutSettings";
import { AdminPayoutLookup } from "./AdminPayoutLookup";
import { SchoolBillingSettingsCard } from "./SchoolBillingSettingsCard";

type Filter = "all" | "paid" | "unpaid" | "void" | "written-off" | "pending";

const filters: Array<{ label: string; status?: InvoiceStatus; value: Filter }> = [
  { label: "All", value: "all" },
  { label: "Unpaid", status: "OPEN", value: "unpaid" },
  { label: "Paid", status: "PAID", value: "paid" },
  { label: "Void", status: "VOID", value: "void" },
  { label: "Written off", status: "UNCOLLECTIBLE", value: "written-off" },
  { label: "Processing", status: "PENDING", value: "pending" },
];

/**
 * Payments for every role: a school's invoices, a teacher's payout setup and
 * earnings, and the admin's view of all invoices.
 */
export function BillingPage({ role, toast }: Pick<RouteProps, "role" | "toast">) {
  if (role === "teacher") return <TeacherEarnings toast={toast} />;
  if (role === "admin") return <AdminPayments toast={toast} />;
  return <SchoolInvoices toast={toast} />;
}

// ---- School ----

function SchoolInvoices({ toast }: { toast: ToastFn }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<PayableInvoice | null>(null);
  const invoicesQuery = useMyInvoices(invoiceQuery(filter, page));
  const invoices = invoicesQuery.data?.invoices ?? [];
  usePaymentReturn(toast);
  const outstanding = invoices.filter((invoice) => invoice.status === "OPEN" || invoice.status === "UNCOLLECTIBLE");
  const paid = invoices.filter((invoice) => invoice.status === "PAID");

  return (
    <div className="app-page billing-page">
      <PageHead
        title="Billing"
        subtitle="Manage your saved card, automatic booking payments and any payments needing attention."
        actions={<RefreshInvoices invoices={invoices} query={invoicesQuery} />}
      />

      <SchoolBillingSettingsCard toast={toast} />

      <div className="billing-metrics mb-6 grid gap-4 sm:grid-cols-3">
        <Stat value={formatPence(sum(outstanding, "totalAmountPence"))} label="Outstanding on this page" />
        <Stat value={outstanding.filter(isOverdue).length} label="Overdue on this page" />
        <Stat value={formatPence(sum(paid, "totalAmountPence"))} label="Paid invoice totals on this page" />
      </div>

      <InvoiceList
        emptyMessage="Automatic booking payment records appear here."
        filter={filter}
        onFilter={(value) => { setFilter(value); setPage(1); }}
        onPage={setPage}
        query={invoicesQuery}
        renderActions={(invoice) => (
          <>
            <Btn size="sm" variant="ghost" onClick={() => setDetailId(invoice.id)}>Details</Btn>
            {isFailedAutomaticPayment(invoice) ? <Btn size="sm" onClick={() => setPayTarget(payable(invoice))}>{requiresCardAuthentication(invoice.lastPaymentFailureCode) ? "Approve card payment" : "Complete card payment"}</Btn> : null}
            <PdfLink invoice={invoice} />
          </>
        )}
        role="institution"
      />
      <InvoiceDetailsModal id={detailId} onClose={() => setDetailId(null)} role="institution" />
      <PayInvoiceModal invoice={payTarget} onClose={() => setPayTarget(null)} toast={toast} />
    </div>
  );
}

// ---- Teacher ----

function TeacherEarnings({ toast }: { toast: ToastFn }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const invoicesQuery = useMyInvoices(invoiceQuery(filter, page));
  const invoices = invoicesQuery.data?.invoices ?? [];
  const paid = invoices.filter((invoice) => invoice.status === "PAID");
  const awaiting = invoices.filter((invoice) => invoice.status === "OPEN" || invoice.status === "UNCOLLECTIBLE");

  return (
    <div className="app-page billing-page">
      <PageHead title="Earnings" subtitle="SupplyEd automatically collects completed booking payments. Stripe then pays your available balance to your bank." actions={<RefreshInvoices invoices={invoices} query={invoicesQuery} />} />

      <PayoutSettings />
      <CashOutCard toast={toast} />

      <div className="billing-metrics my-6 grid gap-4 sm:grid-cols-3">
        <Stat value={formatPence(sum(paid, "teacherAmountPence"))} label="Pay on paid invoices on this page" />
        <Stat value={formatPence(sum(awaiting, "teacherAmountPence"))} label="Automatic payments processing" />
        <Stat value={paid.length} label="Paid bookings on this page" />
      </div>

      <InvoiceList
        emptyMessage="Automatic payment records appear here as booking obligations become payable."
        filter={filter}
        onFilter={(value) => { setFilter(value); setPage(1); }}
        onPage={setPage}
        query={invoicesQuery}
        renderActions={(invoice) => <Btn size="sm" variant="ghost" onClick={() => setDetailId(invoice.id)}>Invoice details</Btn>}
        role="teacher"
      />
      <InvoiceDetailsModal id={detailId} onClose={() => setDetailId(null)} role="teacher" />
    </div>
  );
}

/** Keep cash out discoverable while explaining settlement and payout eligibility. */
function CashOutCard({ toast }: { toast: ToastFn }) {
  const payoutQuery = usePayoutAccount();
  const ready = payoutQuery.data?.ready === true;
  const balanceQuery = usePayoutBalance({ enabled: ready });
  const [confirming, setConfirming] = useState(false);
  const cashOut = useInstantPayout({
    onSuccess: (result) => {
      notify(toast, result, "Cash-out sent", "Could not cash out");
      if (result.ok) setConfirming(false);
    },
  });
  const balance = balanceQuery.data;
  const canCashOut = ready && Boolean(balance?.instantDestination) && (balance?.instantAvailablePence ?? 0) >= 40;
  const checking = payoutQuery.isLoading || ready && balanceQuery.isLoading;
  const refreshing = payoutQuery.isFetching || balanceQuery.isFetching;
  const unavailableReason = checking
    ? "Your payout account and available balance are being checked."
    : payoutQuery.isError || ready && !balance
      ? "Your payout balance could not be checked. Refresh the balance to try again."
      : !ready
        ? "Complete Bank account and payouts setup before withdrawing your earnings."
        : !balance?.instantDestination
          ? "Your linked bank account does not currently support instant cash-outs. Manage Bank account and payouts to add an eligible bank account or debit card."
          : balance.pendingPence > 0
            ? `${formatPence(balance.pendingPence)} has been collected and is awaiting Stripe settlement. Cash out becomes available when Stripe releases eligible funds.`
            : balance.availablePence > 0
              ? `${formatPence(balance.availablePence)} is settled, but Stripe has not made it available for instant cash-out. Standard bank payouts follow your Stripe payout schedule.`
              : "There are no funds available for instant cash-out yet. Cash-outs start at £0.40.";
  const refreshBalance = () => { void Promise.all([payoutQuery.refetch(), balanceQuery.refetch()]); };

  return (
    <>
      <section className="cashout-card card card-pad-lg mt-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[1px] text-muted">Available to cash out now <Tag tone={canCashOut ? "green" : "amber"}>{checking ? "Checking balance" : canCashOut ? "Ready" : (balance?.pendingPence ?? 0) > 0 ? "Funds settling" : "Not available yet"}</Tag></div>
            <div className="mt-1 font-heading text-4xl">{balance ? formatPence(balance.instantAvailablePence) : "—"}</div>
            <p className="mt-2 text-sm text-muted">
              {canCashOut && balance?.instantDestination
                ? `Cash out to ${balance.instantDestination.label}. It usually arrives within 30 minutes, any day.`
                : unavailableReason}
            </p>
            {(balance?.pendingPence ?? 0) > 0 ? <p className="mt-2 text-sm font-semibold">Awaiting settlement: {formatPence(balance!.pendingPence)}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn loading={refreshing} loadingLabel="Checking" size="sm" variant="ghost" onClick={refreshBalance}>Refresh balance</Btn>
            <Btn disabled={!canCashOut || cashOut.isPending} icon="zap" loading={cashOut.isPending} loadingLabel="Sending" onClick={() => setConfirming(true)}>
              {canCashOut ? "Cash out" : "Nothing to cash out"}
            </Btn>
          </div>
        </div>

        {balance?.recentPayouts.length ? (
          <div className="mt-5 border-t border-border pt-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[1px] text-muted">Recent payouts</div>
            {balance.recentPayouts.map((payout) => (
              <div key={payout.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
                <span>
                  {payout.method === "instant" ? "Cash out" : "Automatic payout"}
                  {payout.arrivalDate ? <span className="text-muted"> · {formatDate(payout.arrivalDate)}</span> : null}
                </span>
                <span className="flex items-center gap-2">
                  <Tag tone={payout.status === "paid" ? "green" : payout.status === "failed" || payout.status === "canceled" ? "red" : "amber"}>
                    {payout.status.replace(/_/g, " ")}
                  </Tag>
                  <strong>{formatPence(payout.amountPence)}</strong>
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <Modal open={confirming} onClose={() => !cashOut.isPending && setConfirming(false)}>
        <div className="p-6 sm:p-7">
          <Tag tone={canCashOut ? "green" : "amber"}>{canCashOut ? "Cash out" : (balance?.pendingPence ?? 0) > 0 ? "Funds settling" : "Cash out availability"}</Tag>
          <h2 className="mt-4 font-heading text-2xl">{canCashOut ? `Send ${formatPence(balance!.instantAvailablePence)} now?` : "Cash out is not available yet"}</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            {canCashOut ? `It goes to ${balance?.instantDestination?.label ?? "your bank"} and usually arrives within 30 minutes. The amount shown is what you receive.` : unavailableReason}
          </p>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Btn disabled={cashOut.isPending} variant="ghost" onClick={() => setConfirming(false)}>
              {canCashOut ? "Not now" : "Close"}
            </Btn>
            {canCashOut ? <Btn loading={cashOut.isPending} loadingLabel="Sending" onClick={() => { if (canCashOut) cashOut.mutate(undefined); }}>
              Cash out {formatPence(balance!.instantAvailablePence)}
            </Btn> : <Btn loading={refreshing} loadingLabel="Checking" onClick={refreshBalance}>Refresh balance</Btn>}
          </div>
        </div>
      </Modal>
    </>
  );
}

// ---- Admin ----

function AdminPayments({ toast }: { toast: ToastFn }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [profileFilters, setProfileFilters] = useState<ProfileInvoiceFilters>({});
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [voidTarget, setVoidTarget] = useState<Invoice | null>(null);
  const [refundTarget, setRefundTarget] = useState<Invoice | null>(null);
  const [refundError, setRefundError] = useState<string | null>(null);
  const invoicesQuery = useAllInvoices({ ...invoiceQuery(filter, page), ...profileFilters });
  const invoices = invoicesQuery.data?.invoices ?? [];
  const paid = invoices.filter((invoice) => invoice.status === "PAID");
  const resend = useResendInvoice({ onSuccess: (result) => notify(toast, result, "Invoice sent", "Could not resend invoice"), onError: () => mutationFailure(toast) });
  const voidInvoice = useVoidInvoice({ onSuccess: (result) => { notify(toast, result, "Invoice voided", "Could not void invoice"); if (result.ok) setVoidTarget(null); }, onError: () => mutationFailure(toast) });
  const refund = useRefundInvoice({
    onSuccess: (result) => {
      notify(toast, result, "Refund issued", "Could not refund");
      if (result.ok) { setRefundTarget(null); setRefundError(null); }
      else setRefundError(actionMessage(result));
    },
    onError: () => setRefundError("The refund could not be submitted. Please try again."),
  });

  return (
    <>
      <div className="app-page billing-page">
        <PageHead title="Payments" subtitle="Every invoice on the platform. Void unpaid invoices to reissue them; refund paid ones." actions={<RefreshInvoices invoices={invoices} query={invoicesQuery} />} />

        <AdminInvoiceFilters onApply={(value) => { setProfileFilters(value); setPage(1); }} />
        <AdminPayoutLookup />

        <div className="billing-metrics mb-6 grid gap-4 sm:grid-cols-3">
          <Stat value={formatPence(sum(paid, "totalAmountPence"))} label="Paid invoice totals on this page" />
          <Stat value={formatPence(sum(paid, "feeAmountPence"))} label="Fees on paid invoices on this page" />
          <Stat value={invoices.filter(isUnpaid).length} label="Unpaid invoices on this page" />
        </div>

        <InvoiceList
          emptyMessage="Automatic period invoices and manually created booking invoices appear here."
          filter={filter}
          onFilter={(value) => { setFilter(value); setPage(1); }}
          onPage={setPage}
          query={invoicesQuery}
          renderActions={(invoice) => (
            <>
              <Btn size="sm" variant="ghost" onClick={() => setDetailId(invoice.id)}>Details</Btn>
              <PdfLink invoice={invoice} />
              {invoice.status === "OPEN" || invoice.status === "UNCOLLECTIBLE" ? (
                <Btn
                  disabled={voidInvoice.isPending}
                  loading={voidInvoice.isPending && voidInvoice.variables === invoice.id}
                  loadingLabel="Voiding"
                  size="sm"
                  variant="danger"
                  onClick={() => setVoidTarget(invoice)}
                >
                  Void
                </Btn>
              ) : null}
              {isUnpaid(invoice) ? <Btn disabled={resend.isPending} loading={resend.isPending && resend.variables === invoice.id} loadingLabel="Sending" size="sm" variant="ghost" onClick={() => resend.mutate(invoice.id)}>Email again</Btn> : null}
              {invoice.status === "PAID" && invoice.amountRefundedPence < invoice.totalAmountPence ? (
                <Btn disabled={refund.isPending} size="sm" variant="secondary" onClick={() => { setRefundError(null); setRefundTarget(invoice); }}>
                  Refund
                </Btn>
              ) : null}
            </>
          )}
          role="admin"
        />
      </div>

      <RefundModal
        key={refundTarget?.id ?? "none"}
        invoice={refundTarget}
        error={refundError}
        loading={refund.isPending}
        onClose={() => {
          if (!refund.isPending) setRefundTarget(null);
        }}
        onSubmit={(amountPence, reason) => {
          if (refundTarget) refund.mutate({ amountPence, id: refundTarget.id, reason });
        }}
      />
      <Modal open={Boolean(voidTarget)} onClose={() => { if (!voidInvoice.isPending) setVoidTarget(null); }}>
        <div className="p-6 sm:p-7">
          <h2 className="font-heading text-2xl">Void this invoice?</h2>
          <p className="mt-3 text-sm leading-6 text-muted">This cancels the unpaid invoice for {voidTarget?.booking.jobTitle}. The school can issue a replacement invoice for the booking.</p>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Btn disabled={voidInvoice.isPending} variant="ghost" onClick={() => setVoidTarget(null)}>Keep invoice</Btn>
            <Btn loading={voidInvoice.isPending} loadingLabel="Voiding" variant="danger" onClick={() => { if (voidTarget) voidInvoice.mutate(voidTarget.id); }}>Void invoice</Btn>
          </div>
        </div>

      </Modal>
      <InvoiceDetailsModal id={detailId} onClose={() => setDetailId(null)} role="admin" />
    </>
  );
}

function RefundModal({
  invoice,
  error,
  loading,
  onClose,
  onSubmit,
}: {
  invoice: Invoice | null;
  error: string | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (amountPence: number | undefined, reason: RefundReason) => void;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<RefundReason>("requested_by_customer");
  const refundable = invoice ? invoice.totalAmountPence - invoice.amountRefundedPence : 0;
  const pence = amount.trim() ? Math.round(Number(amount) * 100) : undefined;
  const invalid = refundable < 1 || (pence !== undefined && (!/^\d+(\.\d{1,2})?$/.test(amount.trim()) || !Number.isSafeInteger(pence) || pence < 1 || pence > refundable));

  return (
    <Modal open={Boolean(invoice)} onClose={onClose}>
      <form
        className="p-6 sm:p-7"
        onSubmit={(event) => {
          event.preventDefault();
          if (!loading && !invalid) onSubmit(pence, reason);
        }}
      >
        <Tag tone="red">Refund</Tag>
        <h2 className="mt-4 font-heading text-2xl">Refund {invoice?.booking.institution.name}</h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          Up to {formatPence(refundable)} can be refunded. The teacher&apos;s share is taken back from their Stripe account and the
          SupplyEd fee is refunded in proportion.
        </p>
        <label className="mt-4 block text-sm font-semibold">
          Amount in £ <span className="font-normal text-muted">(leave empty to refund it all)</span>
          <input
            className="input mt-2 w-full"
            inputMode="decimal"
            onChange={(event) => setAmount(event.target.value)}
            placeholder={(refundable / 100).toFixed(2)}
            value={amount}
          />
        </label>
        {error ? <p className="mt-3 text-sm text-danger" role="alert">{error}</p> : null}
        {invalid ? <p className="mt-2 text-sm text-danger">Enter an amount between £0.01 and {formatPence(refundable)}.</p> : null}
        <div className="mt-4 text-sm font-semibold">
          <label htmlFor="invoice-refund-reason">Reason</label>
          <DynamicSelect aria-label="Reason" className="mt-2" id="invoice-refund-reason" onChange={(value) => setReason(value as RefundReason)} collection="refundReason" value={reason} />
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Btn disabled={loading} variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn disabled={invalid} loading={loading} loadingLabel="Refunding" type="submit" variant="danger">
            Issue refund
          </Btn>
        </div>
      </form>
    </Modal>
  );
}

// ---- Shared ----

type ProfileInvoiceFilters = Pick<AdminInvoiceListQuery, "bookingId" | "instructorId" | "institutionId">;

function AdminInvoiceFilters({ onApply }: { onApply: (filters: ProfileInvoiceFilters) => void }) {
  const [values, setValues] = useState({ bookingId: "", instructorId: "", institutionId: "" });
  const [error, setError] = useState<string | null>(null);
  const fields = [
    { key: "bookingId", label: "Booking ID" },
    { key: "instructorId", label: "Instructor profile ID" },
    { key: "institutionId", label: "School profile ID" },
  ] as const;

  return (
    <details className="invoice-filters card card-pad mb-4">
      <summary className="cursor-pointer text-sm font-semibold">Filter invoices by booking or profile</summary>
      <form className="mt-4" onSubmit={(event) => {
        event.preventDefault();
        if (Object.values(values).some((value) => value.trim() && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim()))) {
          setError("Enter a valid UUID for each filter, or leave it empty.");
          return;
        }
        setError(null);
        onApply({ bookingId: values.bookingId.trim() || undefined, instructorId: values.instructorId.trim() || undefined, institutionId: values.institutionId.trim() || undefined });
      }}>
        <div className="grid gap-3 sm:grid-cols-3">
          {fields.map((field) => <label key={field.key} className="text-sm font-semibold">{field.label}<input className="input mt-2 w-full font-normal" value={values[field.key]} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} placeholder="UUID" /></label>)}
        </div>
        {error ? <p className="mt-3 text-sm text-danger" role="alert">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Btn size="sm" variant="ghost" onClick={() => { setValues({ bookingId: "", instructorId: "", institutionId: "" }); setError(null); onApply({}); }}>Clear filters</Btn>
          <Btn size="sm" type="submit">Apply filters</Btn>
        </div>
      </form>
    </details>
  );
}

function InvoiceList({
  emptyMessage,
  filter,
  onFilter,
  onPage,
  query,
  renderActions,
  role,
}: {
  emptyMessage: string;
  filter: Filter;
  onFilter: (filter: Filter) => void;
  onPage: (page: number) => void;
  query: { data?: PaginatedInvoices; error: Error | null; isLoading: boolean };
  renderActions?: (invoice: Invoice) => ReactNode;
  role: AppRole;
}) {
  const choices = useDropdown("invoiceStatus");
  const visibleFilters = [{ label: "All", value: "all" as Filter }, ...(choices.data?.options ?? []).flatMap(option => { const item = filters.find(item => item.status === option.value); return item && (role === "admin" || item.value !== "pending") ? [{ label: option.label, value: item.value }] : []; })];
  const invoices = query.data?.invoices ?? [];
  const pagination = query.data?.pagination;

  return (
    <>
      <div className="workspace-toolbar card card-pad mb-4 flex flex-wrap items-center gap-3">
        <DropdownStatus name="invoiceStatus" />
        {visibleFilters.map((item) => (
          <Btn key={item.value} aria-pressed={filter === item.value} size="sm" variant={filter === item.value ? "secondary" : "ghost"} onClick={() => onFilter(item.value)}>
            {item.label}
          </Btn>
        ))}
      </div>

      {query.isLoading ? <SectionLoader rows={3} /> : null}
      {query.error && !query.isLoading ? (
        <EmptyState title="Invoices unavailable" message={query.error.message || "Refresh the page and try again."} />
      ) : null}
      {!query.isLoading && !query.error && invoices.length === 0 ? <EmptyState title="No invoices here yet" message={emptyMessage} /> : null}

      {!query.isLoading && !query.error && invoices.length > 0 ? (
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <InvoiceRow key={invoice.id} actions={renderActions?.(invoice)} invoice={invoice} role={role} />
          ))}
        </div>
      ) : null}
      {pagination && pagination.totalPages > 1 ? (
        <div className="mt-5 flex items-center justify-between gap-3 text-sm">
          <Btn disabled={pagination.page <= 1 || query.isLoading} size="sm" variant="ghost" onClick={() => onPage(pagination.page - 1)}>Previous</Btn>
          <span className="text-muted">Page {pagination.page} of {pagination.totalPages} · {pagination.total} invoices</span>
          <Btn disabled={!pagination.hasNextPage || query.isLoading} size="sm" variant="ghost" onClick={() => onPage(pagination.page + 1)}>Next</Btn>
        </div>
      ) : null}
    </>
  );
}

function InvoiceRow({ actions, invoice, role }: { actions?: ReactNode; invoice: Invoice; role: AppRole }) {
  const counterpart =
    role === "teacher"
      ? invoice.booking.institution.name
      : role === "institution"
        ? invoice.booking.instructor.name
        : `${invoice.booking.institution.name} → ${invoice.booking.instructor.name}`;
  const amount = role === "teacher" ? invoice.teacherAmountPence : invoice.totalAmountPence;

  return (
    <article className="invoice-card card card-pad-lg">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-xl leading-tight">{invoice.booking.jobTitle}</h3>
            <InvoiceStatusTag invoice={invoice} />
            {isAutomatic(invoice) ? <Tag tone="purple">Automatic</Tag> : <Tag tone="ghost">Manual</Tag>}
            {invoice.amountRefundedPence > 0 ? <Tag tone="ghost">Invoice refunded {formatPence(invoice.amountRefundedPence)}</Tag> : null}
            {invoice.disputeStatus ? <Tag tone="red">Dispute: {invoice.disputeStatus.replaceAll("_", " ")}</Tag> : null}
          </div>
          <div className="mt-1 text-sm text-muted">
            {counterpart} · {formatDateRange(invoice.booking.startDate, invoice.booking.endDate)}
          </div>
          <div className="mt-2 text-xs text-muted">
            {[
              invoice.invoiceNumber ? `Invoice ${invoice.invoiceNumber}` : null,
              invoice.poNumber ? `PO ${invoice.poNumber}` : null,
              describeWork(invoice),
              timing(invoice),
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
          {invoice.lastPaymentFailureMessage && invoice.status === "OPEN" ? <p className="mt-3 rounded-lg border border-warning/20 bg-warning-tint px-3 py-2 text-sm text-warning" role="alert">{invoice.lastPaymentFailureMessage}{invoice.nextPaymentAttemptAt ? ` Next retry: ${formatDateTime(invoice.nextPaymentAttemptAt)}.` : ""}</p> : null}
        </div>
        <div className="text-left sm:text-right">
          <div className="font-heading text-2xl">{formatPence(amount)}</div>
          <div className="text-xs text-muted">
            {role === "teacher" ? "Your pay" : `${formatPence(invoice.teacherAmountPence)} pay + ${formatPence(invoice.feeAmountPence)} fee`}
          </div>
        </div>
      </div>
      {actions ? <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border pt-4">{actions}</div> : null}
    </article>
  );
}

function InvoiceStatusTag({ invoice }: { invoice: Invoice }) {
  if (invoice.status === "PAID") return <Tag tone="green">Paid</Tag>;
  if (invoice.status === "VOID") return <Tag tone="ghost">Void</Tag>;
  if (invoice.status === "UNCOLLECTIBLE") return <Tag tone="red">Written off</Tag>;
  if (invoice.status === "PENDING") return <Tag tone="ghost">Processing</Tag>;
  if (requiresCardAuthentication(invoice.lastPaymentFailureCode)) return <Tag tone="amber">Card approval required</Tag>;
  if (invoice.lastPaymentFailureMessage) return <Tag tone="red">Payment needs attention</Tag>;
  if (isAutomatic(invoice)) {
    const phase = automaticPaymentPhase({
      failureMessage: invoice.lastPaymentFailureMessage,
      nextAttemptAt: invoice.nextPaymentAttemptAt,
      paymentAttemptCount: invoice.paymentAttemptCount,
      status: invoice.status,
    });
    return <Tag tone="amber">{phase === "scheduled" ? "Payment scheduled" : "Automatic payment processing"}</Tag>;
  }
  return isOverdue(invoice) ? <Tag tone="red">Overdue</Tag> : <Tag tone="amber">Awaiting payment</Tag>;
}

function HostedInvoiceLink({ invoice, label = "Open invoice" }: { invoice: Invoice; label?: string }) {
  const url = stripeInvoiceUrl(invoice.hostedInvoiceUrl);
  if (!url) return null;
  return <a className={buttonClassName({ size: "sm", variant: "secondary" })} href={url} rel="noopener noreferrer" target="_blank">{label}</a>;
}

function PdfLink({ invoice }: { invoice: Invoice }) {
  const url = stripeInvoiceUrl(invoice.invoicePdfUrl);
  if (!url || invoice.status === "PENDING") return null;

  return (
    <a className={buttonClassName({ size: "sm", variant: "ghost" })} href={url} rel="noopener noreferrer" target="_blank">
      PDF
    </a>
  );
}

function payable(invoice: Invoice): PayableInvoice {
  return { id: invoice.id, jobTitle: invoice.booking.jobTitle, totalAmountPence: invoice.totalAmountPence - invoice.amountRefundedPence };
}

function RefreshInvoices({ invoices, query }: { invoices: Invoice[]; query: { isFetching: boolean; refetch: () => unknown } }) {
  const sync = useSyncInvoice();
  const refresh = async () => {
    const automatic = invoices.filter((invoice) => isAutomatic(invoice) && isUnpaid(invoice));
    for (const invoice of automatic) await sync.mutateAsync(invoice.id);
    await query.refetch();
  };
  return <Btn loading={sync.isPending || query.isFetching} loadingLabel="Checking Stripe" size="sm" variant="ghost" onClick={() => { void refresh(); }}>Refresh status</Btn>;
}

function invoiceQuery(filter: Filter, page: number) {
  return { limit: 20, page, status: filters.find((item) => item.value === filter)?.status };
}

function isUnpaid(invoice: Invoice) {
  return invoice.status === "OPEN" || invoice.status === "UNCOLLECTIBLE";
}

function isAutomatic(invoice: Invoice) {
  return invoice.collectionMethod === "charge_automatically";
}

function isFailedAutomaticPayment(invoice: Invoice) {
  return isUnpaid(invoice) && isAutomatic(invoice) && Boolean(invoice.lastPaymentFailureMessage || requiresCardAuthentication(invoice.lastPaymentFailureCode));
}


function EmptyState({ title, message }: { title: string; message: string }) {
  return <WorkspaceEmptyState icon="file" message={message} title={title} />;
}

function notify(toast: ToastFn, result: { message?: string; ok: boolean; requestId?: string }, success: string, failure: string) {
  toast({
    msg: actionMessage(result),
    title: result.ok ? success : failure,
    tone: result.ok ? "success" : "danger",
  });
}

function actionMessage(result: { message?: string; ok: boolean; requestId?: string }) {
  const message = result.message ?? (result.ok ? "Done." : "Please try again.");
  return message;
}

function mutationFailure(toast: ToastFn) {
  toast({ title: "Payment action unavailable", msg: "The request could not be submitted. Please try again.", tone: "danger" });
}

function sum(invoices: Invoice[], field: "feeAmountPence" | "teacherAmountPence" | "totalAmountPence") {
  return invoices.reduce((total, invoice) => total + invoice[field], 0);
}

function isOverdue(invoice: Invoice) {
  return invoice.status === "OPEN" && Boolean(invoice.dueAt) && new Date(invoice.dueAt as string).getTime() < Date.now();
}

function describeWork(invoice: Invoice) {
  const rate = formatPence(Math.round(invoice.rateAmount * 100));
  if (invoice.payType === "fixed" || invoice.unitsWorked === null) return `Fixed fee ${rate}`;
  const unit = invoice.payType === "hourly" ? "hour" : "day";
  const work = `${invoice.unitsWorked} ${unit}${invoice.unitsWorked === 1 ? "" : "s"} at ${rate}/${unit}`;
  return invoice.billingPeriodLabel ? `${invoice.billingPeriodLabel}: ${work}` : work;
}

function timing(invoice: Invoice) {
  if (invoice.status === "PAID" && invoice.paidAt) return `Paid ${formatDate(invoice.paidAt)}`;
  if (invoice.status === "VOID" && invoice.voidedAt) return `Voided ${formatDate(invoice.voidedAt)}`;
  if (invoice.nextPaymentAttemptAt && invoice.status === "OPEN") return `Retry ${formatDateTime(invoice.nextPaymentAttemptAt)}`;
  if (invoice.dueAt && (invoice.status === "OPEN" || invoice.status === "UNCOLLECTIBLE")) return `Due ${formatDate(invoice.dueAt)}`;
  return null;
}

function formatDateRange(start?: string | null, end?: string | null) {
  if (!start && !end) return "Dates TBC";
  const startLabel = start ? formatDate(start) : "Start TBC";
  const endLabel = end ? formatDate(end) : startLabel;
  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
