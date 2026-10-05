import type {
  Invoice,
  InvoiceListQuery,
  InvoiceStatus,
  PaginatedInvoices,
  PayoutAccount,
  PayoutBalance,
  PayoutSummary,
  StripeLink,
} from "./types";

export const invoiceStatuses = new Set<InvoiceStatus>(["PENDING", "OPEN", "PAID", "VOID", "UNCOLLECTIBLE"]);

function readDateIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function normalizePayoutAccount(account: Partial<PayoutAccount> | null | undefined): PayoutAccount {
  return {
    chargesEnabled: Boolean(account?.chargesEnabled),
    connected: Boolean(account?.connected),
    detailsSubmitted: Boolean(account?.detailsSubmitted),
    disabledReason: account?.disabledReason ?? null,
    payoutsEnabled: Boolean(account?.payoutsEnabled),
    ready: Boolean(account?.ready),
    requirementsDue: Array.isArray(account?.requirementsDue) ? account.requirementsDue.filter((item) => typeof item === "string") : [],
  };
}

export function normalizePayoutSummary(payout: Partial<PayoutSummary>): PayoutSummary {
  return {
    amountPence: readNumber(payout.amountPence) ?? 0,
    arrivalDate: readDateIso(payout.arrivalDate),
    id: payout.id ?? "",
    method: payout.method ?? "standard",
    status: payout.status ?? "pending",
  };
}

export function normalizePayoutBalance(balance: Partial<PayoutBalance> | null | undefined): PayoutBalance {
  return {
    availablePence: readNumber(balance?.availablePence) ?? 0,
    instantAvailablePence: readNumber(balance?.instantAvailablePence) ?? 0,
    instantDestination: balance?.instantDestination?.id
      ? { id: balance.instantDestination.id, label: balance.instantDestination.label ?? "Your bank" }
      : null,
    pendingPence: readNumber(balance?.pendingPence) ?? 0,
    recentPayouts: Array.isArray(balance?.recentPayouts) ? balance.recentPayouts.map(normalizePayoutSummary) : [],
  };
}

export function normalizeStripeLink(link: Partial<StripeLink>): StripeLink {
  return { expiresAt: readDateIso(link.expiresAt), url: link.url ?? "" };
}

export function normalizeInvoice(invoice: Invoice): Invoice {
  return {
    ...invoice,
    amountRefundedPence: readNumber(invoice.amountRefundedPence) ?? 0,
    booking: {
      endDate: readDateIso(invoice.booking?.endDate),
      id: invoice.booking?.id ?? "",
      institution: { id: invoice.booking?.institution?.id ?? "", name: invoice.booking?.institution?.name ?? "School" },
      instructor: { id: invoice.booking?.instructor?.id ?? "", name: invoice.booking?.instructor?.name ?? "Teacher" },
      jobTitle: invoice.booking?.jobTitle ?? "Booking",
      startDate: readDateIso(invoice.booking?.startDate),
    },
    createdAt: readDateIso(invoice.createdAt),
    currency: invoice.currency ?? "gbp",
    disputeStatus: invoice.disputeStatus ?? null,
    dueAt: readDateIso(invoice.dueAt),
    feeAmountPence: readNumber(invoice.feeAmountPence) ?? 0,
    hostedInvoiceUrl: invoice.hostedInvoiceUrl ?? null,
    invoiceNumber: invoice.invoiceNumber ?? null,
    invoicePdfUrl: invoice.invoicePdfUrl ?? null,
    paidAt: readDateIso(invoice.paidAt),
    payType: invoice.payType ?? "daily",
    poNumber: invoice.poNumber ?? null,
    rateAmount: readNumber(invoice.rateAmount) ?? 0,
    status: invoiceStatuses.has(invoice.status) ? invoice.status : "OPEN",
    teacherAmountPence: readNumber(invoice.teacherAmountPence) ?? 0,
    totalAmountPence: readNumber(invoice.totalAmountPence) ?? 0,
    unitsWorked: readNumber(invoice.unitsWorked),
    updatedAt: readDateIso(invoice.updatedAt),
    voidedAt: readDateIso(invoice.voidedAt),
  };
}

export function normalizePaginatedInvoices(payload: PaginatedInvoices): PaginatedInvoices {
  return {
    invoices: (payload.invoices ?? []).map(normalizeInvoice),
    pagination: {
      hasNextPage: Boolean(payload.pagination?.hasNextPage),
      limit: payload.pagination?.limit ?? 20,
      page: payload.pagination?.page ?? 1,
      total: payload.pagination?.total ?? 0,
      totalPages: payload.pagination?.totalPages ?? 0,
    },
  };
}

export function normalizeInvoicesQuery(query: InvoiceListQuery = {}): InvoiceListQuery {
  return {
    limit: query.limit && Number.isFinite(query.limit) ? Math.min(100, Math.max(1, query.limit)) : 20,
    page: query.page && Number.isFinite(query.page) ? Math.max(1, query.page) : 1,
    status: query.status && invoiceStatuses.has(query.status) ? query.status : undefined,
  };
}

/** Pence to "£1,234.56". */
export function formatPence(pence: number | null | undefined) {
  return new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" }).format((pence ?? 0) / 100);
}

/** Stripe's requirement keys ("identity.individual.date_of_birth.day") as short readable labels. */
export function describeRequirement(key: string) {
  const known: Array<[RegExp, string]> = [
    [/date_of_birth/, "Date of birth"],
    [/address/, "Home address"],
    [/given_name|surname|first_name|last_name/, "Legal name"],
    [/phone/, "Phone number"],
    [/email/, "Email"],
    [/external_account/, "Bank account"],
    [/terms_of_service|tos_acceptance/, "Accept Stripe's terms"],
    [/verification|document|id_number/, "Identity verification"],
    [/mcc|business_profile|product_description|url/, "Business details"],
  ];

  return known.find(([pattern]) => pattern.test(key))?.[1] ?? "Additional details";
}
