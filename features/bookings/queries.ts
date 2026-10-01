import "server-only";

import { api } from "@/lib/server/api-client";

import { normalizeBookingsQuery, normalizePaginatedBookings } from "./schemas";
import type { BookingListQuery, PaginatedBookings } from "./types";

function backendEnabled() {
  return Boolean(process.env.API_BASE_URL);
}

function emptyBookings(query: BookingListQuery): PaginatedBookings {
  return {
    bookings: [],
    pagination: {
      hasNextPage: false,
      limit: query.limit ?? 20,
      page: query.page ?? 1,
      total: 0,
      totalPages: 0,
    },
  };
}

export async function listMyBookings(query: BookingListQuery = {}): Promise<PaginatedBookings> {
  const normalized = normalizeBookingsQuery(query);

  if (!backendEnabled()) return emptyBookings(normalized);

  const result = await api.get<PaginatedBookings>("/bookings/me", {
    next: { tags: ["bookings"] },
    query: normalized,
  });

  return normalizePaginatedBookings(result);
}
