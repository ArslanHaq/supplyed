import { invoiceStatuses } from "./schemas";
import type { AdminInvoiceListQuery, InvoiceStatus } from "./types";

export function readInvoiceListQuery(request: Request, options: { admin?: boolean } = {}): AdminInvoiceListQuery {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as InvoiceStatus | null;

  return {
    limit: Number(searchParams.get("limit") ?? 20),
    page: Number(searchParams.get("page") ?? 1),
    status: status && invoiceStatuses.has(status) && (options.admin || status !== "PENDING") ? status : undefined,
    ...(options.admin ? {
      bookingId: searchParams.get("bookingId") ?? undefined,
      instructorId: searchParams.get("instructorId") ?? undefined,
      institutionId: searchParams.get("institutionId") ?? undefined,
    } : {}),
  };
}
