"use server";

import { revalidateTag } from "next/cache";

import { actionError, actionOk } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";

import { requirePayoutInstructor } from "./payout-auth";
import { normalizeInvoice, normalizePayoutSummary, normalizeSchoolBillingSettings } from "./schemas";
import type { BookingTipCheckoutSession, BookingTipStatusResult, CreateInvoiceInput, Invoice, InvoicePaymentSession, PayoutSession, PayoutSummary, RefundInvoiceInput, SchoolBillingSettings, SchoolBillingSetupSession } from "./types";

/**
 * A fresh session for Stripe's embedded payout components. The client secret
 * goes only to this teacher's browser, which hands it straight to Stripe.
 */
export async function createPayoutSessionAction() {
  try {
    await requirePayoutInstructor();
    const session = await api.post<Partial<PayoutSession>>("/payments/payout-account/session");
    if (!session?.clientSecret || !session.publishableKey) return actionError("Payout setup could not be started. Please try again.");
    return actionOk<PayoutSession>({ clientSecret: session.clientSecret, publishableKey: session.publishableKey });
  } catch (error) {
    return actionError(readPaymentError(error, "Payout setup could not be started."), {
      code: errorCode(error),
      requestId: error instanceof ApiError ? error.requestId : undefined,
    });
  }
}

/** Starts paying an invoice in the app: the secrets Stripe's Payment Element needs. School only. */
export async function createInvoicePaymentSessionAction(id: string) {
  const invoiceId = typeof id === "string" ? id.trim() : "";
  if (!isUuid(invoiceId)) return actionError("Choose a valid invoice.", { code: "INVOICE_ID_REQUIRED" });

  try {
    const session = await api.post<Partial<InvoicePaymentSession>>(`/invoices/${invoiceId}/payment-session`);
    if (!session?.clientSecret || !session.customerSessionClientSecret || !session.publishableKey) {
      return actionError("Payment could not be started. Please try again.");
    }
    return actionOk<InvoicePaymentSession>({
      amountPence: typeof session.amountPence === "number" ? session.amountPence : 0,
      clientSecret: session.clientSecret,
      customerSessionClientSecret: session.customerSessionClientSecret,
      publishableKey: session.publishableKey,
    });
  } catch (error) {
    return actionError(readPaymentError(error, "Payment could not be started."), {
      code: errorCode(error),
      requestId: error instanceof ApiError ? error.requestId : undefined,
    });
  }
}

/** Stripe hosts card entry and saves the card for authorised automatic booking payments. */
export async function createSchoolBillingSetupSessionAction(input: { consentToTerms: boolean }) {
  if (input?.consentToTerms !== true) return actionError("Authorise automatic booking payments before adding a card.");
  try {
    const session = await api.post<Partial<SchoolBillingSetupSession>>("/payments/school-billing/setup-session", { consentToTerms: true });
    const url = stripeCheckoutUrl(session?.url);
    if (!url || !session?.sessionId || !/^cs_(?:test_|live_)?[A-Za-z0-9]+$/.test(session.sessionId)) {
      return actionError("Payment method setup could not be started. Please try again.");
    }
    revalidateTag("school-billing", "max");
    return actionOk<SchoolBillingSetupSession>({
      expiresAt: typeof session.expiresAt === "number" && Number.isFinite(session.expiresAt) ? session.expiresAt : 0,
      sessionId: session.sessionId,
      url,
    });
  } catch (error) {
    return actionError(readPaymentError(error, "Payment method setup could not be started."), { code: errorCode(error), requestId: error instanceof ApiError ? error.requestId : undefined });
  }
}

/** Verifies the latest Checkout session after Stripe sends the school back. */
export async function syncSchoolBillingSetupAction(sessionId: string) {
  const normalized = typeof sessionId === "string" ? sessionId.trim() : "";
  if (!/^cs_(?:test_|live_)?[A-Za-z0-9]+$/.test(normalized)) return actionError("The payment setup reference is invalid.");
  try {
    const settings = await api.post<SchoolBillingSettings>("/payments/school-billing/sync", { sessionId: normalized });
    revalidateTag("school-billing", "max");
    const normalizedSettings = normalizeSchoolBillingSettings(settings);
    return actionOk(normalizedSettings, normalizedSettings.automaticPaymentsEnabled ? "Card saved securely. Automatic booking payments are on." : "Card setup is being checked. Refresh Billing to see the latest status.");
  } catch (error) {
    return actionError(readPaymentError(error, "The payment method status could not be refreshed."), { code: errorCode(error), requestId: error instanceof ApiError ? error.requestId : undefined });
  }
}

export async function updateSchoolAutomaticPaymentsAction(input: { automaticPaymentsEnabled: boolean; consentToTerms?: boolean }) {
  if (!input || typeof input.automaticPaymentsEnabled !== "boolean") return actionError("Choose a valid automatic-payment setting.");
  try {
    const settings = await api.patch<SchoolBillingSettings>("/payments/school-billing", input);
    revalidateTag("school-billing", "max");
    return actionOk(normalizeSchoolBillingSettings(settings), input.automaticPaymentsEnabled ? "Automatic payments enabled." : "Automatic payments disabled.");
  } catch (error) {
    return actionError(readPaymentError(error, "Automatic payment settings could not be updated."), { code: errorCode(error), requestId: error instanceof ApiError ? error.requestId : undefined });
  }
}

export async function createBookingTipCheckoutAction(input: { bookingId: string; amountPence: number }) {
  const bookingId = typeof input?.bookingId === "string" ? input.bookingId.trim() : "";
  if (!isUuid(bookingId)) return actionError("Choose a valid completed booking.");
  if (!Number.isSafeInteger(input.amountPence) || input.amountPence < 1 || input.amountPence > 99_999_999) {
    return actionError("Enter a valid tip amount in pounds and pence.");
  }
  try {
    const session = await api.post<Partial<BookingTipCheckoutSession>>("/payments/booking-tips/checkout", {
      bookingId,
      amountPence: input.amountPence,
    });
    const url = stripeCheckoutUrl(session.url);
    if (!url || !session.tipId || !isUuid(session.tipId) || !session.sessionId) {
      return actionError("The tip checkout could not be started. Please try again.");
    }
    return actionOk<BookingTipCheckoutSession>({
      feeAmountPence: Number(session.feeAmountPence) || 0,
      sessionId: session.sessionId,
      tipAmountPence: Number(session.tipAmountPence) || input.amountPence,
      tipId: session.tipId,
      totalAmountPence: Number(session.totalAmountPence) || input.amountPence,
      url,
    });
  } catch (error) {
    return actionError(readPaymentError(error, "The tip checkout could not be started."), { code: errorCode(error), requestId: error instanceof ApiError ? error.requestId : undefined });
  }
}

export async function syncBookingTipAction(input: { tipId: string; sessionId: string }) {
  const tipId = typeof input?.tipId === "string" ? input.tipId.trim() : "";
  const sessionId = typeof input?.sessionId === "string" ? input.sessionId.trim() : "";
  if (!isUuid(tipId) || !/^cs_(?:test_|live_)?[A-Za-z0-9]+$/.test(sessionId)) {
    return actionError("The tip payment reference is invalid.");
  }
  try {
    const tip = await api.post<BookingTipStatusResult>(`/payments/booking-tips/${tipId}/sync`, { sessionId });
    revalidateTag("bookings", "max");
    return actionOk(tip, tip.status === "PAID" ? "Tip paid successfully." : "Tip submitted and processing.");
  } catch (error) {
    return actionError(readPaymentError(error, "The tip payment status could not be checked."), { code: errorCode(error), requestId: error instanceof ApiError ? error.requestId : undefined });
  }
}

export async function removeSchoolPaymentMethodAction() {
  try {
    const settings = await api.delete<SchoolBillingSettings>("/payments/school-billing/payment-method");
    revalidateTag("school-billing", "max");
    return actionOk(normalizeSchoolBillingSettings(settings), "Payment method removed and automatic payments disabled.");
  } catch (error) {
    return actionError(readPaymentError(error, "The payment method could not be removed."), { code: errorCode(error), requestId: error instanceof ApiError ? error.requestId : undefined });
  }
}

/** Reads the invoice's latest status from Stripe, so a payment shows without waiting for the webhook. */
export async function syncInvoiceAction(id: string) {
  const invoiceId = typeof id === "string" ? id.trim() : "";
  if (!isUuid(invoiceId)) return actionError("Choose a valid invoice.", { code: "INVOICE_ID_REQUIRED" });

  try {
    const invoice = await api.post<Invoice>(`/invoices/${invoiceId}/sync`);
    revalidateTag("invoices", "max");
    revalidateTag("bookings", "max");
    return actionOk(normalizeInvoice(invoice));
  } catch (error) {
    return actionError(readPaymentError(error, "The payment status could not be checked."), { code: errorCode(error) });
  }
}

/** Cashes out the teacher's instantly available balance (or part of it) to their bank or debit card. */
export async function instantPayoutAction(amountPence?: number) {
  if (amountPence !== undefined && (!Number.isSafeInteger(amountPence) || amountPence < 40)) {
    return actionError("Cash-outs start at £0.40.", { code: "PAYOUT_AMOUNT_INVALID" });
  }

  try {
    const payout = await api.post<PayoutSummary>("/payments/payout-account/instant-payout", { amountPence });
    return actionOk(
      normalizePayoutSummary(payout),
      "Stripe confirmed the cash-out. Your available balance has been reduced and the transfer is on its way.",
    );
  } catch (error) {
    return actionError(readPaymentError(error, "The cash-out could not be sent."), { code: errorCode(error) });
  }
}

export async function createInvoiceAction(input: CreateInvoiceInput) {
  if (!input || typeof input.bookingId !== "string" || (input.poNumber !== undefined && typeof input.poNumber !== "string")) return actionError("Check the booking and invoice details.");
  const bookingId = input.bookingId.trim();
  if (!isUuid(bookingId)) return actionError("Choose a valid booking.", { code: "BOOKING_ID_REQUIRED" });

  const poNumber = input.poNumber?.trim() || undefined;
  if (poNumber && poNumber.length > 100) return actionError("PO number must be 100 characters or fewer.", { code: "PO_TOO_LONG" });

  if (input.unitsWorked !== undefined) {
    const units = input.unitsWorked;
    // A tolerance, not ===: 4.55 * 100 is 454.99999999999994 in floating point.
    if (!Number.isFinite(units) || units < 0.01 || units > 9999.99 || Math.abs(Math.round(units * 100) - units * 100) > 1e-6) {
      return actionError("Enter time worked between 0.01 and 9,999.99 with up to two decimal places.", { code: "UNITS_INVALID" });
    }
  }

  try {
    const invoice = await api.post<Invoice>("/invoices", {
      bookingId,
      ...(poNumber ? { poNumber } : {}),
      ...(input.unitsWorked !== undefined ? { unitsWorked: input.unitsWorked } : {}),
    });
    revalidateTag("invoices", "max");
    revalidateTag("bookings", "max");
    return actionOk(normalizeInvoice(invoice), "Invoice sent to the school.");
  } catch (error) {
    return actionError(readPaymentError(error, "The invoice could not be created."), { code: errorCode(error), requestId: error instanceof ApiError ? error.requestId : undefined });
  }
}

export async function resendInvoiceAction(id: string) {
  return invoiceCommand(id, "send", "Invoice emailed again.", "The invoice could not be resent.");
}

export async function voidInvoiceAction(id: string) {
  return invoiceCommand(id, "void", "Invoice voided. The booking can be invoiced again.", "The invoice could not be voided.");
}

export async function refundInvoiceAction(input: RefundInvoiceInput) {
  if (!input || typeof input.id !== "string") return actionError("Choose a valid invoice.");
  const id = input.id.trim();
  if (!isUuid(id)) return actionError("Choose a valid invoice.", { code: "INVOICE_ID_REQUIRED" });
  if (input.amountPence !== undefined && (!Number.isSafeInteger(input.amountPence) || input.amountPence < 1)) {
    return actionError("Enter a refund amount of at least 1p.", { code: "REFUND_AMOUNT_INVALID" });
  }
  if (input.reason && !["duplicate", "fraudulent", "requested_by_customer"].includes(input.reason)) {
    return actionError("Choose a valid refund reason.", { code: "REFUND_REASON_INVALID" });
  }

  try {
    const invoice = await api.post<Invoice>(`/invoices/${id}/refund`, {
      amountPence: input.amountPence,
      reason: input.reason,
    });
    revalidateTag("invoices", "max");
    return actionOk(normalizeInvoice(invoice), "Refund issued.");
  } catch (error) {
    return actionError(readPaymentError(error, "The refund could not be issued."), { code: errorCode(error), requestId: error instanceof ApiError ? error.requestId : undefined });
  }
}

async function invoiceCommand(id: string, command: "send" | "void", success: string, failure: string) {
  const invoiceId = typeof id === "string" ? id.trim() : "";
  if (!isUuid(invoiceId)) return actionError("Choose a valid invoice.", { code: "INVOICE_ID_REQUIRED" });

  try {
    const invoice = await api.post<Invoice>(`/invoices/${invoiceId}/${command}`);
    revalidateTag("invoices", "max");
    revalidateTag("bookings", "max");
    return actionOk(normalizeInvoice(invoice), success);
  } catch (error) {
    return actionError(readPaymentError(error, failure), { code: errorCode(error), requestId: error instanceof ApiError ? error.requestId : undefined });
  }
}

function errorCode(error: unknown) {
  return error instanceof ApiError ? error.code : undefined;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function stripeCheckoutUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && url.hostname === "checkout.stripe.com" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function readPaymentError(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.message) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
