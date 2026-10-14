import { listMyInvoices } from "@/features/payments/queries";
import { readInvoiceListQuery } from "@/features/payments/route-query";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return Response.json(await listMyInvoices(readInvoiceListQuery(request)));
  } catch (error) {
    return routeError(error);
  }
}
