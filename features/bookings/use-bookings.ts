"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";

import { createBookingReviewAction, updateBookingStatusAction } from "./actions";
import type { BookingListQuery, BookingReviewInput, BookingStatusUpdateInput, PaginatedBookings } from "./types";

type BookingActionResult = Awaited<ReturnType<typeof updateBookingStatusAction>>;
type ReviewActionResult = Awaited<ReturnType<typeof createBookingReviewAction>>;

type MutationOptions<Result> = {
  onError?: () => void;
  onSuccess?: (result: Result) => void | Promise<void>;
};

export function useBookings(query: BookingListQuery = {}) {
  return useQuery({
    queryFn: () => fetchJson<PaginatedBookings>("/api/bookings/me", { query }),
    queryKey: queryKeys.bookings.mine(query),
  });
}

export function useUpdateBookingStatus(options: MutationOptions<BookingActionResult> = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BookingStatusUpdateInput) => updateBookingStatusAction(input),
    onError: options.onError,
    onSuccess: async (result) => {
      if (result.ok) await queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
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
