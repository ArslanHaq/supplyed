import "server-only";

import { api, ApiError } from "@/lib/server/api-client";
import { requirePayoutInstructor } from "./payout-auth";

import {
  normalizeAdminInvoicesQuery,
  normalizeInvoice,
  normalizeInvoicesQuery,
  normalizePaginatedInvoices,
  normalizePayoutAccount,
  normalizePayoutBalance,
} from "./schemas";
import type {
  AdminInvoiceListQuery,
  Invoice,
  InvoiceListQuery,
  PaginatedInvoices,
  PayoutAccount,
  PayoutBalance,
} from "./types";

function backendEnabled() {
  return Boolean(process.env.API_BASE_URL);
}

function emptyInvoices(query: InvoiceListQuery): PaginatedInvoices {
  return {
    invoices: [],
    pagination: { hasNextPage: false, limit: query.limit ?? 20, page: query.page ?? 1, total: 0, totalPages: 0 },
  };
}

/** The teacher's payout setup. */
export async function getMyPayoutAccount(): Promise<PayoutAccount> {
  await requirePayoutInstructor();
  if (!backendEnabled()) throw new ApiError("Payout settings are unavailable. Please try again later.", 503);

  return normalizePayoutAccount(await api.get<PayoutAccount>("/payments/payout-account", { cache: "no-store" }));
}

/** The teacher's Stripe balance, including what can be cashed out now. */
export async function getMyPayoutBalance(): Promise<PayoutBalance> {
  if (!backendEnabled()) return normalizePayoutBalance(null);

  return normalizePayoutBalance(await api.get<PayoutBalance>("/payments/payout-account/balance", { cache: "no-store" }));
}

/** A school's bills, or a teacher's earnings. */
export async function listMyInvoices(query: InvoiceListQuery = {}): Promise<PaginatedInvoices> {
  const normalized = normalizeInvoicesQuery(query);
  if (!backendEnabled()) return emptyInvoices(normalized);

  const result = await api.get<PaginatedInvoices>("/invoices/me", {
    cache: "no-store",
    query: normalized,
  });

  return normalizePaginatedInvoices(result);
}

/** Admin: every invoice on the platform. */
export async function listAllInvoices(query: AdminInvoiceListQuery = {}): Promise<PaginatedInvoices> {
  const normalized = normalizeAdminInvoicesQuery(query);
  if (!backendEnabled()) return emptyInvoices(normalized);

  const result = await api.get<PaginatedInvoices>("/invoices", {
    cache: "no-store",
    query: normalized,
  });

  return normalizePaginatedInvoices(result);
}

/** Invoice parties and administrators can read their latest Stripe invoice state. */
export async function getInvoice(id: string): Promise<Invoice> {
  return normalizeInvoice(await api.get<Invoice>(`/invoices/${encodeURIComponent(id)}`, { cache: "no-store" }));
}
