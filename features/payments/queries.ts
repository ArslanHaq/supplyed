import "server-only";

import { api } from "@/lib/server/api-client";

import { normalizeInvoicesQuery, normalizePaginatedInvoices, normalizePayoutAccount } from "./schemas";
import type { InvoiceListQuery, PaginatedInvoices, PayoutAccount } from "./types";

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
  if (!backendEnabled()) return normalizePayoutAccount(null);

  return normalizePayoutAccount(await api.get<PayoutAccount>("/payments/payout-account", { cache: "no-store" }));
}

/** A school's bills, or a teacher's earnings. */
export async function listMyInvoices(query: InvoiceListQuery = {}): Promise<PaginatedInvoices> {
  const normalized = normalizeInvoicesQuery(query);
  if (!backendEnabled()) return emptyInvoices(normalized);

  const result = await api.get<PaginatedInvoices>("/invoices/me", {
    next: { tags: ["invoices"] },
    query: normalized,
  });

  return normalizePaginatedInvoices(result);
}

/** Admin: every invoice on the platform. */
export async function listAllInvoices(query: InvoiceListQuery = {}): Promise<PaginatedInvoices> {
  const normalized = normalizeInvoicesQuery(query);
  if (!backendEnabled()) return emptyInvoices(normalized);

  const result = await api.get<PaginatedInvoices>("/invoices", {
    next: { tags: ["invoices"] },
    query: normalized,
  });

  return normalizePaginatedInvoices(result);
}
