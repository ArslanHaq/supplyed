"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { describeRequirement, formatPence } from "@/features/payments/schemas";
import type { Invoice, InvoiceStatus, PaginatedInvoices, RefundReason } from "@/features/payments/types";
import {
  useAllInvoices,
  useMyInvoices,
  usePayoutAccount,
  usePayoutLink,
  useRefundInvoice,
  useResendInvoice,
  useVoidInvoice,
} from "@/features/payments/use-payments";
import type { AppRole, RouteProps, ToastFn } from "@/types/supplyed";

import { Btn, buttonClassName, Stat, Tag } from "../atoms";
import { Modal, PageHead, SectionLoader } from "../molecules";

type Filter = "all" | "paid" | "unpaid" | "void";

const filters: Array<{ label: string; status?: InvoiceStatus; value: Filter }> = [
  { label: "All", value: "all" },
  { label: "Unpaid", status: "OPEN", value: "unpaid" },
  { label: "Paid", status: "PAID", value: "paid" },
  { label: "Void", status: "VOID", value: "void" },
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
  const invoicesQuery = useMyInvoices({ limit: 100 });
  const invoices = invoicesQuery.data?.invoices ?? [];
  const resend = useResendInvoice({ onSuccess: (result) => notify(toast, result, "Invoice sent", "Could not resend invoice") });
  const outstanding = invoices.filter((invoice) => invoice.status === "OPEN" || invoice.status === "UNCOLLECTIBLE");
  const paidThisYear = invoices.filter((invoice) => invoice.status === "PAID" && isThisYear(invoice.paidAt));

  return (
    <div className="app-page">
      <PageHead
        title="Billing"
        subtitle="Invoices for completed bookings. Each one covers the teacher's pay plus the SupplyEd processing fee."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat value={formatPence(sum(outstanding, "totalAmountPence"))} label="Outstanding" />
        <Stat value={outstanding.filter(isOverdue).length} label="Overdue invoices" />
        <Stat value={formatPence(sum(paidThisYear, "totalAmountPence"))} label="Paid this year" />
      </div>

      <InvoiceList
        emptyMessage="Invoices appear here once you invoice a completed booking from Bookings."
        filter={filter}
        onFilter={setFilter}
        query={invoicesQuery}
        renderActions={(invoice) => (
          <>
            {invoice.status === "OPEN" && invoice.hostedInvoiceUrl ? (
              <a className={buttonClassName({ size: "sm" })} href={invoice.hostedInvoiceUrl} rel="noopener noreferrer" target="_blank">
                Pay invoice
              </a>
            ) : null}
            <PdfLink invoice={invoice} />
            {invoice.status === "OPEN" ? (
              <Btn
                disabled={resend.isPending}
                loading={resend.isPending && resend.variables === invoice.id}
                loadingLabel="Sending"
                size="sm"
                variant="ghost"
                onClick={() => resend.mutate(invoice.id)}
              >
                Email again
              </Btn>
            ) : null}
          </>
        )}
        role="institution"
      />
    </div>
  );
}

// ---- Teacher ----

function TeacherEarnings({ toast }: { toast: ToastFn }) {
  const searchParams = useSearchParams();
  const returned = searchParams.get("payouts");
  const [filter, setFilter] = useState<Filter>("all");
  const invoicesQuery = useMyInvoices({ limit: 100 });
  const invoices = invoicesQuery.data?.invoices ?? [];
  const paid = invoices.filter((invoice) => invoice.status === "PAID");
  const awaiting = invoices.filter((invoice) => invoice.status === "OPEN" || invoice.status === "UNCOLLECTIBLE");

  return (
    <div className="app-page">
      <PageHead title="Earnings" subtitle="Get paid for your bookings. Schools pay through Stripe and your share goes straight to your bank." />

      {returned === "returned" ? (
        <Notice tone="green">Thanks. Stripe is checking your details; this can take a minute. Refresh if your status has not updated.</Notice>
      ) : null}
      {returned === "error" ? <Notice tone="red">We could not reopen payout setup. Try again below.</Notice> : null}

      <PayoutSetupCard toast={toast} />

      <div className="my-6 grid gap-4 sm:grid-cols-3">
        <Stat value={formatPence(sum(paid, "teacherAmountPence"))} label="Paid to you" />
        <Stat value={formatPence(sum(awaiting, "teacherAmountPence"))} label="Awaiting school payment" />
        <Stat value={paid.length} label="Paid bookings" />
      </div>

      <InvoiceList
        emptyMessage="Once a school invoices a completed booking, it appears here with your pay."
        filter={filter}
        onFilter={setFilter}
        query={invoicesQuery}
        role="teacher"
      />
    </div>
  );
}

function PayoutSetupCard({ toast }: { toast: ToastFn }) {
  const payoutQuery = usePayoutAccount();
  const account = payoutQuery.data;
  const onFailure = (result: { message?: string; ok: boolean }) => {
    if (!result.ok) toast({ msg: result.message ?? "Please try again.", title: "Could not open Stripe", tone: "danger" });
  };
  const onboarding = usePayoutLink("onboarding", { onSuccess: onFailure });
  const dashboard = usePayoutLink("dashboard", { onSuccess: onFailure });
  const missing = [...new Set((account?.requirementsDue ?? []).map(describeRequirement))];

  if (payoutQuery.isLoading) return <SectionLoader rows={2} />;

  if (payoutQuery.error || !account) {
    return <Notice tone="red">Payout status is unavailable right now. Refresh the page to try again.</Notice>;
  }

  return (
    <section className="card card-pad-lg">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[240px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-2xl leading-tight">Payouts</h2>
            {account.ready ? (
              <Tag tone="green">Active</Tag>
            ) : account.connected ? (
              <Tag tone="amber">Action needed</Tag>
            ) : (
              <Tag tone="ghost">Not set up</Tag>
            )}
          </div>
          <p className="mt-2 max-w-[560px] text-sm leading-6 text-muted">
            {account.ready
              ? "You're set up to be paid. Schools' payments for your bookings go straight to your bank account."
              : account.connected
                ? "Stripe needs a few more details before you can be paid. It only takes a couple of minutes."
                : "Add your bank account through Stripe, our payments partner, so schools can pay you. SupplyEd never sees your bank details."}
          </p>
          {!account.ready && account.connected && missing.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {missing.map((label) => (
                <li key={label}>
                  <Tag tone="ghost">{label}</Tag>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {account.ready ? (
            <Btn loading={dashboard.isPending} loadingLabel="Opening" variant="secondary" onClick={() => dashboard.mutate()}>
              Manage payouts
            </Btn>
          ) : (
            <Btn loading={onboarding.isPending} loadingLabel="Opening Stripe" onClick={() => onboarding.mutate()}>
              {account.connected ? "Continue setup" : "Set up payouts"}
            </Btn>
          )}
        </div>
      </div>
    </section>
  );
}

// ---- Admin ----

function AdminPayments({ toast }: { toast: ToastFn }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [refundTarget, setRefundTarget] = useState<Invoice | null>(null);
  const invoicesQuery = useAllInvoices({ limit: 100 });
  const invoices = invoicesQuery.data?.invoices ?? [];
  const paid = invoices.filter((invoice) => invoice.status === "PAID");
  const voidInvoice = useVoidInvoice({ onSuccess: (result) => notify(toast, result, "Invoice voided", "Could not void invoice") });
  const refund = useRefundInvoice({
    onSuccess: (result) => {
      notify(toast, result, "Refund issued", "Could not refund");
      if (result.ok) setRefundTarget(null);
    },
  });

  return (
    <>
      <div className="app-page">
        <PageHead title="Payments" subtitle="Every invoice on the platform. Void unpaid invoices to reissue them; refund paid ones." />

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Stat value={formatPence(sum(paid, "totalAmountPence"))} label="Collected" />
          <Stat value={formatPence(sum(paid, "feeAmountPence"))} label="SupplyEd fees" />
          <Stat value={invoices.filter((invoice) => invoice.status === "OPEN").length} label="Unpaid invoices" />
        </div>

        <InvoiceList
          emptyMessage="Invoices appear here when schools invoice completed bookings."
          filter={filter}
          onFilter={setFilter}
          query={invoicesQuery}
          renderActions={(invoice) => (
            <>
              <PdfLink invoice={invoice} />
              {invoice.status === "OPEN" || invoice.status === "UNCOLLECTIBLE" ? (
                <Btn
                  disabled={voidInvoice.isPending}
                  loading={voidInvoice.isPending && voidInvoice.variables === invoice.id}
                  loadingLabel="Voiding"
                  size="sm"
                  variant="danger"
                  onClick={() => voidInvoice.mutate(invoice.id)}
                >
                  Void
                </Btn>
              ) : null}
              {invoice.status === "PAID" && invoice.amountRefundedPence < invoice.totalAmountPence ? (
                <Btn size="sm" variant="secondary" onClick={() => setRefundTarget(invoice)}>
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
        loading={refund.isPending}
        onClose={() => {
          if (!refund.isPending) setRefundTarget(null);
        }}
        onSubmit={(amountPence, reason) => {
          if (refundTarget) refund.mutate({ amountPence, id: refundTarget.id, reason });
        }}
      />
    </>
  );
}

function RefundModal({
  invoice,
  loading,
  onClose,
  onSubmit,
}: {
  invoice: Invoice | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (amountPence: number | undefined, reason: RefundReason) => void;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<RefundReason>("requested_by_customer");
  const refundable = invoice ? invoice.totalAmountPence - invoice.amountRefundedPence : 0;
  const pence = amount.trim() ? Math.round(Number(amount) * 100) : undefined;
  const invalid = pence !== undefined && (!Number.isFinite(pence) || pence < 1 || pence > refundable);

  return (
    <Modal open={Boolean(invoice)} onClose={onClose}>
      <form
        className="p-6 sm:p-7"
        onSubmit={(event) => {
          event.preventDefault();
          if (!invalid) onSubmit(pence, reason);
        }}
      >
        <Tag tone="red">Refund</Tag>
        <h2 className="mt-4 font-serif text-2xl">Refund {invoice?.booking.institution.name}</h2>
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
        {invalid ? <p className="mt-2 text-sm text-danger">Enter an amount between £0.01 and {formatPence(refundable)}.</p> : null}
        <label className="mt-4 block text-sm font-semibold">
          Reason
          <select className="input mt-2 w-full" onChange={(event) => setReason(event.target.value as RefundReason)} value={reason}>
            <option value="requested_by_customer">Requested by the school</option>
            <option value="duplicate">Duplicate payment</option>
            <option value="fraudulent">Fraudulent</option>
          </select>
        </label>
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

function InvoiceList({
  emptyMessage,
  filter,
  onFilter,
  query,
  renderActions,
  role,
}: {
  emptyMessage: string;
  filter: Filter;
  onFilter: (filter: Filter) => void;
  query: { data?: PaginatedInvoices; error: Error | null; isLoading: boolean };
  renderActions?: (invoice: Invoice) => ReactNode;
  role: AppRole;
}) {
  const status = filters.find((item) => item.value === filter)?.status;
  const invoices = (query.data?.invoices ?? []).filter((invoice) => !status || invoice.status === status);

  return (
    <>
      <div className="card card-pad mb-4 flex flex-wrap items-center gap-3">
        {filters.map((item) => (
          <Btn key={item.value} size="sm" variant={filter === item.value ? "secondary" : "ghost"} onClick={() => onFilter(item.value)}>
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
    <article className="card card-pad-lg">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-xl leading-tight">{invoice.booking.jobTitle}</h3>
            <InvoiceStatusTag invoice={invoice} />
            {invoice.amountRefundedPence > 0 ? <Tag tone="ghost">Refunded {formatPence(invoice.amountRefundedPence)}</Tag> : null}
            {invoice.disputeStatus ? <Tag tone="red">Disputed</Tag> : null}
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
        </div>
        <div className="text-left sm:text-right">
          <div className="font-serif text-2xl">{formatPence(amount)}</div>
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
  return isOverdue(invoice) ? <Tag tone="red">Overdue</Tag> : <Tag tone="amber">Awaiting payment</Tag>;
}

function PdfLink({ invoice }: { invoice: Invoice }) {
  if (!invoice.invoicePdfUrl || invoice.status === "PENDING") return null;

  return (
    <a className={buttonClassName({ size: "sm", variant: "ghost" })} href={invoice.invoicePdfUrl} rel="noopener noreferrer" target="_blank">
      PDF
    </a>
  );
}

function Notice({ children, tone }: { children: ReactNode; tone: "green" | "red" }) {
  return (
    <p
      className={`mb-4 rounded-lg px-4 py-3 text-sm ${tone === "green" ? "bg-success-tint text-success" : "bg-danger-tint text-danger"}`}
      role="status"
    >
      {children}
    </p>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="card card-pad-lg text-center">
      <div className="font-serif text-[24px]">{title}</div>
      <p className="mx-auto mt-2 max-w-[460px] text-sm leading-6 text-muted">{message}</p>
    </div>
  );
}

function notify(toast: ToastFn, result: { message?: string; ok: boolean }, success: string, failure: string) {
  toast({
    msg: result.message ?? (result.ok ? "Done." : "Please try again."),
    title: result.ok ? success : failure,
    tone: result.ok ? "success" : "danger",
  });
}

function sum(invoices: Invoice[], field: "feeAmountPence" | "teacherAmountPence" | "totalAmountPence") {
  return invoices.reduce((total, invoice) => total + invoice[field], 0);
}

function isOverdue(invoice: Invoice) {
  return invoice.status === "OPEN" && Boolean(invoice.dueAt) && new Date(invoice.dueAt as string).getTime() < Date.now();
}

function isThisYear(value: string | null) {
  return Boolean(value) && new Date(value as string).getFullYear() === new Date().getFullYear();
}

function describeWork(invoice: Invoice) {
  const rate = formatPence(Math.round(invoice.rateAmount * 100));
  if (invoice.payType === "fixed" || invoice.unitsWorked === null) return `Fixed fee ${rate}`;
  const unit = invoice.payType === "hourly" ? "hour" : "day";
  return `${invoice.unitsWorked} ${unit}${invoice.unitsWorked === 1 ? "" : "s"} at ${rate}/${unit}`;
}

function timing(invoice: Invoice) {
  if (invoice.status === "PAID" && invoice.paidAt) return `Paid ${formatDate(invoice.paidAt)}`;
  if (invoice.status === "VOID" && invoice.voidedAt) return `Voided ${formatDate(invoice.voidedAt)}`;
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
