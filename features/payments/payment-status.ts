export type AutomaticPaymentPhase = "failed" | "paid" | "preparing" | "processing" | "scheduled";

type PaymentState = {
  failureMessage?: string | null;
  nextAttemptAt?: string | null;
  paymentAttemptCount?: number | null;
  status: string;
};

export function requiresCardAuthentication(code: string | null | undefined) {
  return code === "authentication_required" || code === "invoice_payment_intent_requires_action" || code === "payment_intent_requires_action";
}

/** One interpretation shared by booking, invoice and school-billing screens. */
export function automaticPaymentPhase(payment: PaymentState): AutomaticPaymentPhase {
  if (payment.status === "PAID") return "paid";
  if (payment.failureMessage) return "failed";
  if (payment.status === "PENDING") return "preparing";
  if ((payment.paymentAttemptCount ?? 0) === 0 && payment.nextAttemptAt) return "scheduled";
  return "processing";
}

/** Manual invoice creation requires the school to have explicitly disabled automation. */
export function canPayBookingManually(input: {
  role: string;
  bookingStatus: string;
  automaticState?: string;
  schoolAutomaticPaymentsEnabled?: boolean;
  invoice?: { status: string; automatic: boolean; failed: boolean } | null;
  payroll?: { covered: boolean; pendingAmountPence: number; reviewAmountPence: number; payableAmountPence: number } | null;
}) {
  if (input.role !== "institution") return false;
  if (input.invoice) {
    return ["OPEN", "UNCOLLECTIBLE"].includes(input.invoice.status) &&
      (!input.invoice.automatic || input.invoice.failed);
  }
  return input.schoolAutomaticPaymentsEnabled === false && input.bookingStatus === "COMPLETED" && input.automaticState === "DISABLED" &&
    !(input.payroll?.covered && (input.payroll.pendingAmountPence > 0 || input.payroll.reviewAmountPence > 0 || input.payroll.payableAmountPence <= 0));
}
