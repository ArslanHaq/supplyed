"use client";

import { stripeInvoiceUrl } from "@/features/payments/invoice-links";
import { formatPence } from "@/features/payments/schemas";
import { useInvoice } from "@/features/payments/use-payments";
import type { Invoice } from "@/features/payments/types";
import type { AppRole } from "@/types/supplyed";

import { Btn, buttonClassName, Tag } from "../atoms";
import { Modal, SectionLoader } from "../molecules";

/** onPay, for the school, opens the in-app payment for an unpaid invoice. */
export function InvoiceDetailsModal({ id, onClose, onPay, role }: { id: string | null; onClose: () => void; onPay?: (invoice: Invoice) => void; role: AppRole }) {
  const query = useInvoice(id);
  const invoice = query.data;
  const paymentUrl = stripeInvoiceUrl(invoice?.hostedInvoiceUrl);
  const pdfUrl = stripeInvoiceUrl(invoice?.invoicePdfUrl);
  const unpaid = invoice?.status === "OPEN" || invoice?.status === "UNCOLLECTIBLE";

  return (
    <Modal open={Boolean(id)} onClose={onClose}>
      <div className="max-h-[85vh] overflow-y-auto p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-heading text-2xl">Invoice details</h2>
          <Btn size="sm" variant="ghost" onClick={onClose}>Close</Btn>
        </div>
        {query.isLoading ? <div className="mt-5"><SectionLoader rows={3} /></div> : null}
        {query.error ? <p className="mt-4 text-sm text-danger" role="alert">{query.error.message}</p> : null}
        {invoice ? (
          <>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Tag tone={invoice.status === "PAID" ? "green" : unpaid ? "amber" : "ghost"}>{invoice.status === "UNCOLLECTIBLE" ? "Written off" : invoice.status.toLowerCase()}</Tag>
              <span className="text-sm text-muted">{invoice.invoiceNumber ?? invoice.id}</span>
            </div>
            <h3 className="mt-4 font-semibold">{invoice.booking.jobTitle}</h3>
            <p className="mt-1 text-sm text-muted">{invoice.booking.institution.name} · {invoice.booking.instructor.name}</p>
            <dl className="mt-5 space-y-3 text-sm">
              <Row label="Teacher pay" value={formatPence(invoice.teacherAmountPence)} />
              <Row label="SupplyEd processing fee" value={formatPence(invoice.feeAmountPence)} />
              <Row label="Total invoice" value={formatPence(invoice.totalAmountPence)} />
              <Row label="Agreed rate" value={`${formatPence(Math.round(invoice.rateAmount * 100))}${invoice.payType === "fixed" ? " fixed" : ` per ${invoice.payType === "hourly" ? "hour" : "day"}`}`} />
              {invoice.payType !== "fixed" && invoice.unitsWorked !== null ? <Row label="Time worked" value={`${invoice.unitsWorked} ${invoice.payType === "hourly" ? "hours" : "days"}`} /> : null}
              {invoice.poNumber ? <Row label="PO number" value={invoice.poNumber} /> : null}
              {role === "admin" ? <>
                <Row label="Booking ID" value={invoice.booking.id} />
                <Row label="Instructor profile ID" value={invoice.booking.instructor.id} />
                <Row label="School profile ID" value={invoice.booking.institution.id} />
              </> : null}
              {invoice.dueAt ? <Row label="Due" value={date(invoice.dueAt)} /> : null}
              {invoice.paidAt ? <Row label="Paid" value={date(invoice.paidAt)} /> : null}
              {invoice.voidedAt ? <Row label="Voided" value={date(invoice.voidedAt)} /> : null}
              {invoice.amountRefundedPence > 0 ? <Row label="Refunded from invoice" value={formatPence(invoice.amountRefundedPence)} /> : null}
              {invoice.disputeStatus ? <Row label="Dispute status" value={invoice.disputeStatus.replaceAll("_", " ")} /> : null}
            </dl>
            {unpaid ? <p className="mt-5 text-xs leading-5 text-muted">Payment status refreshes automatically.</p> : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              {pdfUrl ? <a className={buttonClassName({ size: "sm", variant: "ghost" })} href={pdfUrl} rel="noopener noreferrer" target="_blank">Download PDF</a> : null}
              {role === "institution" && unpaid && onPay ? <Btn size="sm" onClick={() => onPay(invoice)}>Pay now</Btn> : null}
              {role === "admin" && unpaid && paymentUrl ? <a className={buttonClassName({ size: "sm", variant: "ghost" })} href={paymentUrl} rel="noopener noreferrer" target="_blank">Open in Stripe</a> : null}
            </div>
          </>
        ) : null}
        <div className="mt-4 flex justify-end">
          <Btn loading={query.isFetching} loadingLabel="Refreshing" size="sm" variant="ghost" onClick={() => { void query.refetch(); }}>Refresh status</Btn>
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4"><dt className="text-muted">{label}</dt><dd className="min-w-0 break-words text-right font-semibold">{value}</dd></div>;
}

function date(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}
