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
