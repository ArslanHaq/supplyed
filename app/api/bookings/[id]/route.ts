import { api } from "@/lib/server/api-client";
import { routeError } from "@/lib/server/route-error";
import { normalizeBooking } from "@/features/bookings/schemas";
import type { Booking } from "@/features/bookings/types";

export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return Response.json(normalizeBooking(await api.get<Booking>(`/bookings/${encodeURIComponent(id)}`, { cache: "no-store" })));
  } catch (error) { return routeError(error); }
}
