export type AutomaticPaymentPhase = "failed" | "paid" | "preparing" | "processing" | "scheduled";

type PaymentState = {
  failureMessage?: string | null;
  nextAttemptAt?: string | null;
  paymentAttemptCount?: number | null;
  status: string;
};

/** ACTION_REQUIRED is the backend's own code; the others are raw Stripe codes it can also store. */
export function requiresCardAuthentication(code: string | null | undefined) {
  return code === "ACTION_REQUIRED" || code === "authentication_required" || code === "invoice_payment_intent_requires_action" || code === "payment_intent_requires_action";
}

/** One interpretation shared by booking, invoice and school-billing screens. */
export function automaticPaymentPhase(payment: PaymentState): AutomaticPaymentPhase {
  if (payment.status === "PAID") return "paid";
  if (payment.failureMessage) return "failed";
  if (payment.status === "PENDING") return "preparing";
  if ((payment.paymentAttemptCount ?? 0) === 0 && payment.nextAttemptAt) return "scheduled";
  return "processing";
}

/**
 * When the school can pay a booking by hand. An unpaid manual invoice, or a failed automatic one, is paid
 * directly. Otherwise a completed booking can be invoiced when automatic collection will not cover it: the
 * school switched automation off, or the booking needs review (an older booking, a cancelled automatic
 * payment). The server bills only work not already invoiced, so a paid earlier period is no obstacle.
 */
export function canPayBookingManually(input: {
  role: string;
  bookingStatus: string;
  automaticState?: string;
  schoolAutomaticPaymentsEnabled?: boolean;
  invoice?: { status: string; automatic: boolean; failed: boolean } | null;
  payroll?: { covered: boolean; pendingAmountPence: number; reviewAmountPence: number; payableAmountPence: number } | null;
}) {
  if (input.role !== "institution") return false;
  if (input.invoice && input.invoice.status !== "PAID") {
    return ["OPEN", "UNCOLLECTIBLE"].includes(input.invoice.status) &&
      (!input.invoice.automatic || input.invoice.failed);
  }
  const notCollectedAutomatically = (input.automaticState === "DISABLED" && input.schoolAutomaticPaymentsEnabled === false) ||
    input.automaticState === "REVIEW_REQUIRED";
  return notCollectedAutomatically && input.bookingStatus === "COMPLETED" &&
    !(input.payroll?.covered && (input.payroll.pendingAmountPence > 0 || input.payroll.reviewAmountPence > 0 || input.payroll.payableAmountPence <= 0));
}
