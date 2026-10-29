import type { InvoiceStatus } from "./types";

export const activeInvoiceRefreshMs = 15_000;
export const settledInvoiceRefreshMs = 5 * 60_000;

const activeStatuses = new Set<InvoiceStatus>(["PENDING", "OPEN", "UNCOLLECTIBLE"]);

/**
 * Active invoices reconcile quickly while Stripe can still change their
 * payment state. Paid invoices use a slower check for refunds and disputes;
 * void invoices are final and rely on explicit invalidation/manual refresh.
 */
export function invoiceRefreshInterval(invoices?: ReadonlyArray<Pick<{ status: InvoiceStatus }, "status">>): number | false {
  if (!invoices?.length) return false;
  if (invoices.some((invoice) => activeStatuses.has(invoice.status))) return activeInvoiceRefreshMs;
  if (invoices.some((invoice) => invoice.status === "PAID")) return settledInvoiceRefreshMs;
  return false;
}
