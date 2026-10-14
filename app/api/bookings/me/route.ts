import { listMyBookings } from "@/features/bookings/queries";
import type { BookingInvoiceFilter, BookingListQuery, BookingStatus } from "@/features/bookings/types";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

const bookingStatuses = new Set<BookingStatus>(["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]);
const invoiceFilters = new Set<BookingInvoiceFilter>(["none", "unpaid", "paid"]);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as BookingStatus | null;
    const invoice = searchParams.get("invoice") as BookingInvoiceFilter | null;
    const query: BookingListQuery = {
      from: searchParams.get("from") || undefined,
      invoice: invoice && invoiceFilters.has(invoice) ? invoice : undefined,
      jobId: searchParams.get("jobId") || undefined,
      limit: Number(searchParams.get("limit") ?? 20),
      page: Number(searchParams.get("page") ?? 1),
      search: searchParams.get("search") || undefined,
      status: status && bookingStatuses.has(status) ? status : undefined,
      to: searchParams.get("to") || undefined,
    };

    return Response.json(await listMyBookings(query));
  } catch (error) {
    return routeError(error);
  }
}
