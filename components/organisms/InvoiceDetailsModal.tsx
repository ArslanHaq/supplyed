"use client";
import { formatPlannedUnits } from "@/features/jobs/work-units";


import { stripeInvoiceUrl } from "@/features/payments/invoice-links";
import { automaticPaymentPhase, requiresCardAuthentication } from "@/features/payments/payment-status";
import { formatPence } from "@/features/payments/schemas";
import { useInvoice, useSyncInvoice } from "@/features/payments/use-payments";
import type { Invoice } from "@/features/payments/types";
import type { AppRole } from "@/types/supplyed";

import { Btn, buttonClassName, Tag } from "../atoms";
import { Modal, SectionLoader } from "../molecules";

export function InvoiceDetailsModal({ id, onClose, role }: { id: string | null; onClose: () => void; role: AppRole }) {
  const query = useInvoice(id);
  const sync = useSyncInvoice();
  const invoice = query.data;
  const paymentUrl = stripeInvoiceUrl(invoice?.hostedInvoiceUrl);
  const pdfUrl = stripeInvoiceUrl(invoice?.invoicePdfUrl);
  const unpaid = invoice?.status === "OPEN" || invoice?.status === "UNCOLLECTIBLE";
  const automatic = invoice?.collectionMethod === "charge_automatically";
  const cardApprovalRequired = requiresCardAuthentication(invoice?.lastPaymentFailureCode);
  const paymentFailed = invoice?.status === "OPEN" && Boolean(invoice.lastPaymentFailureMessage || cardApprovalRequired);
  const paymentPhase = invoice && automatic
    ? automaticPaymentPhase({
        failureMessage: invoice.lastPaymentFailureMessage,
        nextAttemptAt: invoice.nextPaymentAttemptAt,
        paymentAttemptCount: invoice.paymentAttemptCount,
        status: invoice.status,
      })
    : null;

  return (
    <Modal open={Boolean(id)} onClose={onClose}>
      <div className="invoice-detail-modal max-h-[85vh] overflow-y-auto p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-heading text-2xl">Invoice details</h2>
          <Btn size="sm" variant="ghost" onClick={onClose}>Close</Btn>
        </div>
        {query.isLoading ? <div className="mt-5"><SectionLoader rows={3} /></div> : null}
        {query.error ? <p className="mt-4 text-sm text-danger" role="alert">{query.error.message}</p> : null}
        {invoice ? (
          <>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Tag tone={invoice.status === "PAID" ? "green" : paymentFailed || invoice.status === "UNCOLLECTIBLE" ? "red" : unpaid ? "amber" : "ghost"}>
                {invoice.status === "UNCOLLECTIBLE" ? "Written off" : paymentFailed ? cardApprovalRequired ? "Card approval required" : "Payment needs attention" : paymentPhase === "scheduled" ? "Payment scheduled" : automatic && invoice.status === "OPEN" ? "Automatic payment processing" : invoice.status.toLowerCase()}
              </Tag>
              <Tag tone={automatic ? "purple" : "ghost"}>{automatic ? "Automatic collection" : "Manual invoice"}</Tag>
              <span className="text-sm text-muted">{invoice.invoiceNumber ?? invoice.id}</span>
            </div>
            <h3 className="mt-4 font-semibold">{invoice.booking.jobTitle}</h3>
            <p className="mt-1 text-sm text-muted">{invoice.booking.institution.name} · {invoice.booking.instructor.name}</p>
            <div className="invoice-total"><span>Total invoice</span><strong>{formatPence(invoice.totalAmountPence)}</strong></div>
            <dl className="invoice-breakdown mt-5 space-y-3 text-sm">
              <Row label="Teacher pay" value={formatPence(invoice.teacherAmountPence)} />
              <Row label="SupplyEd processing fee" value={formatPence(invoice.feeAmountPence)} />
              <Row label="Total invoice" value={formatPence(invoice.totalAmountPence)} />
              <Row label="Collection" value={automatic ? "Automatic payment" : "Manual invoice"} />
              {invoice.billingPeriodLabel ? <Row label="Billing period" value={invoice.billingPeriodLabel} /> : null}
              <Row label="Agreed rate" value={`${formatPence(Math.round(invoice.rateAmount * 100))}${invoice.payType === "fixed" ? " fixed" : ` per ${invoice.payType === "hourly" ? "hour" : "day"}`}`} />
              {invoice.booking.hours != null || invoice.booking.days != null ? <Row label="Planned work (agreed)" value={formatPlannedUnits(invoice.booking)} /> : null}
              {invoice.payType !== "fixed" && invoice.unitsWorked !== null ? <Row label="Time worked" value={`${invoice.unitsWorked} ${invoice.payType === "hourly" ? "hours" : "days"}`} /> : null}
              {invoice.poNumber ? <Row label="PO number" value={invoice.poNumber} /> : null}
              {role === "admin" ? <>
                <Row label="Booking ID" value={invoice.booking.id} />
                <Row label="Instructor profile ID" value={invoice.booking.instructor.id} />
                <Row label="School profile ID" value={invoice.booking.institution.id} />
              </> : null}
              {invoice.dueAt ? <Row label="Due" value={date(invoice.dueAt)} /> : null}
              {automatic && invoice.paymentAttemptCount > 0 ? <Row label="Payment attempts" value={String(invoice.paymentAttemptCount)} /> : null}
              {invoice.nextPaymentAttemptAt ? <Row label="Next automatic attempt" value={dateTime(invoice.nextPaymentAttemptAt)} /> : null}
              {invoice.paidAt ? <Row label="Paid" value={date(invoice.paidAt)} /> : null}
              {invoice.voidedAt ? <Row label="Voided" value={date(invoice.voidedAt)} /> : null}
              {invoice.amountRefundedPence > 0 ? <Row label="Refunded from invoice" value={formatPence(invoice.amountRefundedPence)} /> : null}
              {invoice.disputeStatus ? <Row label="Dispute status" value={invoice.disputeStatus.replaceAll("_", " ")} /> : null}
            </dl>
            {paymentFailed ? (
              <div className="mt-5 rounded-lg border border-danger/20 bg-danger-tint p-3 text-sm text-danger" role="alert">
                <strong>{cardApprovalRequired ? "The card's bank requires a security check." : "Automatic payment was not successful."}</strong>
                <p className="mt-1">{invoice.lastPaymentFailureMessage ?? "Approve the card payment from Billing."}</p>
                {invoice.lastPaymentFailureCode ? <p className="mt-1 text-xs">Reference: {invoice.lastPaymentFailureCode}</p> : null}
              </div>
            ) : null}
            {unpaid ? <p className="mt-5 text-xs leading-5 text-muted">{paymentFailed ? "The school can complete this card payment from Billing. A card security check may be required." : paymentPhase === "scheduled" ? "Stripe has scheduled automatic payment. No payment release or invoice approval is needed." : "Payment status refreshes automatically when Stripe confirms the result. Successful payment and the teacher's bank payout are separate steps."}</p> : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              {pdfUrl ? <a className={buttonClassName({ size: "sm", variant: "ghost" })} href={pdfUrl} rel="noopener noreferrer" target="_blank">Download PDF</a> : null}
              {role === "admin" && unpaid && paymentUrl ? <a className={buttonClassName({ size: "sm", variant: "ghost" })} href={paymentUrl} rel="noopener noreferrer" target="_blank">Open in Stripe</a> : null}
            </div>
          </>
        ) : null}
        <div className="mt-4 flex justify-end">
          <Btn disabled={!id} loading={sync.isPending} loadingLabel="Checking Stripe" size="sm" variant="ghost" onClick={() => { if (id) sync.mutate(id); }}>Refresh status</Btn>
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="invoice-breakdown-row flex justify-between gap-4"><dt className="text-muted">{label}</dt><dd className="min-w-0 break-words text-right font-semibold">{value}</dd></div>;
}

function date(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
