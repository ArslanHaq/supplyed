"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";

import { createBookingReviewAction, updateBookingStatusAction } from "./actions";
import type { Booking, BookingListQuery, BookingReviewInput, BookingStatusUpdateInput, PaginatedBookings } from "./types";

export function useBooking(id?: string) {
  return useQuery({ enabled: Boolean(id), queryKey: queryKeys.bookings.detail(id ?? ""), queryFn: ({ signal }) => fetchJson<Booking>(`/api/bookings/${id}`, { signal }), refetchOnMount: "always" });
}

type BookingActionResult = Awaited<ReturnType<typeof updateBookingStatusAction>>;
type ReviewActionResult = Awaited<ReturnType<typeof createBookingReviewAction>>;

type MutationOptions<Result> = {
  onError?: () => void;
  onSuccess?: (result: Result) => void | Promise<void>;
};

export function useBookings(query: BookingListQuery = {}, enabled = true) {
  return useQuery({
    enabled,
    queryFn: ({ signal }) => fetchJson<PaginatedBookings>("/api/bookings/me", { query, signal }),
    queryKey: queryKeys.bookings.mine(query),
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: (current) => current.state.data?.bookings.some((booking) => booking.invoice?.status === "OPEN" || booking.invoice?.status === "UNCOLLECTIBLE") ? 15_000 : false,
  });
}

export function useUpdateBookingStatus(options: MutationOptions<BookingActionResult> = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BookingStatusUpdateInput) => updateBookingStatusAction(input),
    onError: options.onError,
    onSuccess: async (result) => {
      if (result.ok) await Promise.all(
        [queryKeys.bookings.all, queryKeys.teachers.all, queryKeys.publicProfiles.all]
          .map(queryKey => queryClient.invalidateQueries({ queryKey })),
      );
      await options.onSuccess?.(result);
    },
  });
}

export function useCreateBookingReview(options: MutationOptions<ReviewActionResult> = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BookingReviewInput) => createBookingReviewAction(input),
    onError: options.onError,
    onSuccess: async (result) => {
      if (result.ok) await queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
      await options.onSuccess?.(result);
    },
  });
}
