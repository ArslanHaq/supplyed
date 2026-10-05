"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { formatPence } from "@/features/payments/schemas";
import { stripeInvoiceUrl } from "@/features/payments/invoice-links";
import type { AdminInvoiceListQuery, Invoice, InvoiceStatus, PaginatedInvoices, RefundReason } from "@/features/payments/types";
import {
  useAllInvoices,
  useMyInvoices,
  useRefundInvoice,
  useResendInvoice,
  useVoidInvoice,
} from "@/features/payments/use-payments";
import type { AppRole, RouteProps, ToastFn } from "@/types/supplyed";

import { Btn, buttonClassName, Stat, Tag } from "../atoms";
import { Modal, PageHead, SectionLoader } from "../molecules";
import { InvoiceDetailsModal } from "./InvoiceDetailsModal";
import { PayoutSettings } from "./PayoutSettings";
import { AdminPayoutLookup } from "./AdminPayoutLookup";

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
  if (role === "teacher") return <TeacherEarnings />;
  if (role === "admin") return <AdminPayments toast={toast} />;
  return <SchoolInvoices toast={toast} />;
}

// ---- School ----

function SchoolInvoices({ toast }: { toast: ToastFn }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const invoicesQuery = useMyInvoices(invoiceQuery(filter, page));
  const invoices = invoicesQuery.data?.invoices ?? [];
  const resend = useResendInvoice({ onSuccess: (result) => notify(toast, result, "Invoice sent", "Could not resend invoice"), onError: () => mutationFailure(toast) });
  const outstanding = invoices.filter((invoice) => invoice.status === "OPEN" || invoice.status === "UNCOLLECTIBLE");
  const paid = invoices.filter((invoice) => invoice.status === "PAID");

  return (
    <div className="app-page">
      <PageHead
        title="Billing"
        subtitle="Invoices for completed bookings. Each one covers the teacher's pay plus the SupplyEd processing fee."
        actions={<RefreshInvoices query={invoicesQuery} />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat value={formatPence(sum(outstanding, "totalAmountPence"))} label="Outstanding on this page" />
        <Stat value={outstanding.filter(isOverdue).length} label="Overdue on this page" />
        <Stat value={formatPence(sum(paid, "totalAmountPence"))} label="Paid invoice totals on this page" />
      </div>

      <InvoiceList
        emptyMessage="Invoices appear here once you invoice a completed booking from Bookings."
        filter={filter}
        onFilter={(value) => { setFilter(value); setPage(1); }}
        onPage={setPage}
        query={invoicesQuery}
        renderActions={(invoice) => (
          <>
            <Btn size="sm" variant="ghost" onClick={() => setDetailId(invoice.id)}>Details</Btn>
            <PaymentLink invoice={invoice} />
            <PdfLink invoice={invoice} />
            {isUnpaid(invoice) ? (
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
      <InvoiceDetailsModal id={detailId} onClose={() => setDetailId(null)} role="institution" />
    </div>
  );
}

// ---- Teacher ----

function TeacherEarnings() {
  const searchParams = useSearchParams();
  const returned = searchParams.get("payouts");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const invoicesQuery = useMyInvoices(invoiceQuery(filter, page));
  const invoices = invoicesQuery.data?.invoices ?? [];
  const paid = invoices.filter((invoice) => invoice.status === "PAID");
  const awaiting = invoices.filter((invoice) => invoice.status === "OPEN" || invoice.status === "UNCOLLECTIBLE");

  return (
    <div className="app-page">
      <PageHead title="Earnings" subtitle="Schools pay booking invoices through Stripe. Your earnings are sent to your connected payout account." actions={<RefreshInvoices query={invoicesQuery} />} />

      {returned === "returned" ? (
        <Notice tone="green">Thanks. Stripe is checking your details; this can take a minute. Refresh if your status has not updated.</Notice>
      ) : null}
      {returned === "error" ? <Notice tone="red">We could not reopen payout setup. Try again below.</Notice> : null}

      <PayoutSettings returnedFromStripe={returned === "returned"} />

      <div className="my-6 grid gap-4 sm:grid-cols-3">
        <Stat value={formatPence(sum(paid, "teacherAmountPence"))} label="Pay on paid invoices on this page" />
        <Stat value={formatPence(sum(awaiting, "teacherAmountPence"))} label="Awaiting payment on this page" />
        <Stat value={paid.length} label="Paid bookings on this page" />
      </div>

      <InvoiceList
        emptyMessage="Once a school invoices a completed booking, it appears here with your pay."
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
      <div className="app-page">
        <PageHead title="Payments" subtitle="Every invoice on the platform. Void unpaid invoices to reissue them; refund paid ones." actions={<RefreshInvoices query={invoicesQuery} />} />

        <AdminInvoiceFilters onApply={(value) => { setProfileFilters(value); setPage(1); }} />
        <AdminPayoutLookup />

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Stat value={formatPence(sum(paid, "totalAmountPence"))} label="Paid invoice totals on this page" />
          <Stat value={formatPence(sum(paid, "feeAmountPence"))} label="Fees on paid invoices on this page" />
          <Stat value={invoices.filter(isUnpaid).length} label="Unpaid invoices on this page" />
        </div>

        <InvoiceList
          emptyMessage="Invoices appear here when schools invoice completed bookings."
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
          <h2 className="font-serif text-2xl">Void this invoice?</h2>
          <p className="mt-3 text-sm leading-6 text-muted">This cancels the unpaid invoice for {voidTarget?.booking.jobTitle}. The school can issue a replacement invoice for the booking.</p>
          <div className="mt-6 flex justify-end gap-3">
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
        {error ? <p className="mt-3 text-sm text-danger" role="alert">{error}</p> : null}
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
    <details className="card card-pad mb-4">
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
  const invoices = query.data?.invoices ?? [];
  const pagination = query.data?.pagination;

  return (
    <>
      <div className="card card-pad mb-4 flex flex-wrap items-center gap-3">
        {filters.filter((item) => role === "admin" || item.value !== "pending").map((item) => (
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
    <article className="card card-pad-lg">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-xl leading-tight">{invoice.booking.jobTitle}</h3>
            <InvoiceStatusTag invoice={invoice} />
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
  const url = stripeInvoiceUrl(invoice.invoicePdfUrl);
  if (!url || invoice.status === "PENDING") return null;

  return (
    <a className={buttonClassName({ size: "sm", variant: "ghost" })} href={url} rel="noopener noreferrer" target="_blank">
      PDF
    </a>
  );
}

function PaymentLink({ invoice }: { invoice: Invoice }) {
  const url = stripeInvoiceUrl(invoice.hostedInvoiceUrl);
  return isUnpaid(invoice) && url ? <a className={buttonClassName({ size: "sm" })} href={url} rel="noopener noreferrer" target="_blank">Pay in Stripe</a> : null;
}

function RefreshInvoices({ query }: { query: { isFetching: boolean; refetch: () => unknown } }) {
  return <Btn loading={query.isFetching} loadingLabel="Refreshing" size="sm" variant="ghost" onClick={() => { void query.refetch(); }}>Refresh status</Btn>;
}

function invoiceQuery(filter: Filter, page: number) {
  return { limit: 20, page, status: filters.find((item) => item.value === filter)?.status };
}

function isUnpaid(invoice: Invoice) {
  return invoice.status === "OPEN" || invoice.status === "UNCOLLECTIBLE";
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

function notify(toast: ToastFn, result: { message?: string; ok: boolean; requestId?: string }, success: string, failure: string) {
  toast({
    msg: actionMessage(result),
    title: result.ok ? success : failure,
    tone: result.ok ? "success" : "danger",
  });
}

function actionMessage(result: { message?: string; ok: boolean; requestId?: string }) {
  const message = result.message ?? (result.ok ? "Done." : "Please try again.");
  return !result.ok && result.requestId ? `${message} Support reference: ${result.requestId}` : message;
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
