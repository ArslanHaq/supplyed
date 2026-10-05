"use server";

import { revalidateTag } from "next/cache";

import { actionError, actionOk } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";

import { normalizeInvoice, normalizePayoutSummary, normalizeStripeLink } from "./schemas";
import type { CreateInvoiceInput, Invoice, PayoutSummary, RefundInvoiceInput, StripeLink } from "./types";

/** A fresh Stripe onboarding link for the signed-in teacher; the client redirects to it. */
export async function createPayoutOnboardingLinkAction() {
  try {
    const link = await api.post<StripeLink>("/payments/payout-account/onboarding-link");
    return actionOk(normalizeStripeLink(link));
  } catch (error) {
    return actionError(readPaymentError(error, "Payout setup could not be started."), { code: errorCode(error) });
  }
}

/** A one-time login to the teacher's Stripe Express dashboard. */
export async function createPayoutDashboardLinkAction() {
  try {
    const link = await api.post<StripeLink>("/payments/payout-account/dashboard-link");
    return actionOk(normalizeStripeLink(link));
  } catch (error) {
    return actionError(readPaymentError(error, "The payouts dashboard could not be opened."), { code: errorCode(error) });
  }
}

/** Cashes out the teacher's instantly available balance (or part of it) to their bank or debit card. */
export async function instantPayoutAction(amountPence?: number) {
  if (amountPence !== undefined && (!Number.isInteger(amountPence) || amountPence < 40)) {
    return actionError("Cash-outs start at £0.40.", { code: "PAYOUT_AMOUNT_INVALID" });
  }

  try {
    const payout = await api.post<PayoutSummary>("/payments/payout-account/instant-payout", { amountPence });
    return actionOk(normalizePayoutSummary(payout), "On its way. It usually arrives within 30 minutes.");
  } catch (error) {
    return actionError(readPaymentError(error, "The cash-out could not be sent."), { code: errorCode(error) });
  }
}

export async function createInvoiceAction(input: CreateInvoiceInput) {
  const bookingId = input.bookingId.trim();
  if (!bookingId) return actionError("Choose a valid booking.", { code: "BOOKING_ID_REQUIRED" });

  const poNumber = input.poNumber?.trim() || undefined;
  if (poNumber && poNumber.length > 100) return actionError("PO number must be 100 characters or fewer.", { code: "PO_TOO_LONG" });

  if (input.unitsWorked !== undefined) {
    const units = input.unitsWorked;
    // A tolerance, not ===: 4.55 * 100 is 454.99999999999994 in floating point.
    if (!Number.isFinite(units) || units <= 0 || Math.abs(Math.round(units * 100) - units * 100) > 1e-6) {
      return actionError("Enter the time worked as a positive number with up to two decimal places.", { code: "UNITS_INVALID" });
    }
  }

  try {
    const invoice = await api.post<Invoice>("/invoices", { bookingId, poNumber, unitsWorked: input.unitsWorked });
    revalidateTag("invoices", "max");
    revalidateTag("bookings", "max");
    return actionOk(normalizeInvoice(invoice), "Invoice sent to the school.");
  } catch (error) {
    return actionError(readPaymentError(error, "The invoice could not be created."), { code: errorCode(error) });
  }
}

export async function resendInvoiceAction(id: string) {
  return invoiceCommand(id, "send", "Invoice emailed again.", "The invoice could not be resent.");
}

export async function voidInvoiceAction(id: string) {
  return invoiceCommand(id, "void", "Invoice voided. The booking can be invoiced again.", "The invoice could not be voided.");
}

export async function refundInvoiceAction(input: RefundInvoiceInput) {
  if (input.amountPence !== undefined && (!Number.isInteger(input.amountPence) || input.amountPence < 1)) {
    return actionError("Enter a refund amount of at least 1p.", { code: "REFUND_AMOUNT_INVALID" });
  }

  try {
    const invoice = await api.post<Invoice>(`/invoices/${input.id.trim()}/refund`, {
      amountPence: input.amountPence,
      reason: input.reason,
    });
    revalidateTag("invoices", "max");
    return actionOk(normalizeInvoice(invoice), "Refund issued.");
  } catch (error) {
    return actionError(readPaymentError(error, "The refund could not be issued."), { code: errorCode(error) });
  }
}

async function invoiceCommand(id: string, command: "send" | "void", success: string, failure: string) {
  const invoiceId = id.trim();
  if (!invoiceId) return actionError("Choose a valid invoice.", { code: "INVOICE_ID_REQUIRED" });

  try {
    const invoice = await api.post<Invoice>(`/invoices/${invoiceId}/${command}`);
    revalidateTag("invoices", "max");
    revalidateTag("bookings", "max");
    return actionOk(normalizeInvoice(invoice), success);
  } catch (error) {
    return actionError(readPaymentError(error, failure), { code: errorCode(error) });
  }
}

function errorCode(error: unknown) {
  return error instanceof ApiError ? error.code : undefined;
}

function readPaymentError(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.message) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
