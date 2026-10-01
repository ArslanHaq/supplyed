import { listMyBookings } from "@/features/bookings/queries";
import type { BookingListQuery, BookingStatus } from "@/features/bookings/types";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

const bookingStatuses = new Set<BookingStatus>(["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as BookingStatus | null;
    const query: BookingListQuery = {
      limit: Number(searchParams.get("limit") ?? 20),
      page: Number(searchParams.get("page") ?? 1),
      status: status && bookingStatuses.has(status) ? status : undefined,
    };

    return Response.json(await listMyBookings(query));
  } catch (error) {
    return routeError(error);
  }
}
