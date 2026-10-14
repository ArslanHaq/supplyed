import { listAllInvoices } from "@/features/payments/queries";
import { readInvoiceListQuery } from "@/features/payments/route-query";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

/** Admin only; the backend refuses everyone else. */
export async function GET(request: Request) {
  try {
    return Response.json(await listAllInvoices(readInvoiceListQuery(request, { admin: true })));
  } catch (error) {
    return routeError(error);
  }
}
