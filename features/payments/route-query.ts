import { invoiceStatuses } from "./schemas";
import type { InvoiceListQuery, InvoiceStatus } from "./types";

export function readInvoiceListQuery(request: Request): InvoiceListQuery {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as InvoiceStatus | null;

  return {
    limit: Number(searchParams.get("limit") ?? 20),
    page: Number(searchParams.get("page") ?? 1),
    status: status && invoiceStatuses.has(status) ? status : undefined,
  };
}
