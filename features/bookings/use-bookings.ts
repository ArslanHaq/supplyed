"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";

import {
  activateAttendanceAction,
  correctAttendanceAction,
  createBookingReviewAction,
  respondAttendanceAction,
  reviewAttendanceCorrectionAction,
  syncBookingPaymentAction,
  updateBookingStatusAction,
} from "./actions";
import type {
  AttendanceActivationInput,
  AttendanceCorrectionInput,
  AttendanceCorrectionReviewInput,
  AttendanceResponseInput,
  Booking,
  BookingListQuery,
  BookingReviewInput,
  BookingStatusUpdateInput,
  PaginatedBookings,
} from "./types";

export function useBooking(id?: string) {
  return useQuery({
    enabled: Boolean(id),
    queryKey: queryKeys.bookings.detail(id ?? ""),
    queryFn: () => fetchJson<Booking>(`/api/bookings/${id}`),
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: (current) => current.state.data && paymentNeedsRefresh(current.state.data) ? 15_000 : false,
  });
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
    queryFn: () => fetchJson<PaginatedBookings>("/api/bookings/me", { query }),
    queryKey: queryKeys.bookings.mine(query),
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: (current) => current.state.data?.bookings.some(paymentNeedsRefresh) ? 15_000 : false,
  });
}

function paymentNeedsRefresh(booking: Booking) {
  const state = booking.automaticPayment?.state;
  return (booking.status === "COMPLETED" && !booking.invoice && state !== "NO_PAYMENT_DUE" && state !== "DISABLED")
    || (booking.status === "CONFIRMED" && Boolean(state) && state !== "DISABLED")
    || state === "PREPARING" || state === "SCHEDULED" || state === "PROCESSING"
    || booking.invoice?.status === "PENDING" || booking.invoice?.status === "OPEN" || booking.invoice?.status === "UNCOLLECTIBLE"
    || booking.tip?.status === "PENDING" || booking.tip?.status === "PROCESSING";
}

export function useSyncBookingPayment(options: MutationOptions<Awaited<ReturnType<typeof syncBookingPaymentAction>>> = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncBookingPaymentAction,
    onError: options.onError,
    onSuccess: async (result) => {
      if (result.ok) {
        queryClient.setQueryData(queryKeys.bookings.detail(result.data.id), result.data);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.payments.all }),
        ]);
      }
      await options.onSuccess?.(result);
    },
  });
}

export function useUpdateBookingStatus(options: MutationOptions<BookingActionResult> = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BookingStatusUpdateInput) => updateBookingStatusAction(input),
    onError: options.onError,
    onSuccess: async (result, input) => {
      if (result.ok) {
        queryClient.setQueryData(queryKeys.bookings.detail(result.data.id), result.data);
        if (input.action === "complete") {
          // Completion has already succeeded. Payment setup or a temporary
          // provider outage must never turn it into a failed booking action.
          try {
            const payment = await syncBookingPaymentAction(result.data.id);
            if (payment.ok) queryClient.setQueryData(queryKeys.bookings.detail(payment.data.id), payment.data);
          } catch {
            // The reconciliation worker and booking polling will retry.
          }
        }
        await Promise.all(
          [queryKeys.bookings.all, queryKeys.teachers.all, queryKeys.publicProfiles.all, queryKeys.payments.all]
            .map(queryKey => queryClient.invalidateQueries({ queryKey })),
        );
      }
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

function useAttendanceMutation<Input>(
  mutationFn: (input: Input) => Promise<Awaited<ReturnType<typeof respondAttendanceAction>>>,
  options: MutationOptions<Awaited<ReturnType<typeof respondAttendanceAction>>> = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onError: options.onError,
    onSuccess: async (result) => {
      if (result.ok) await queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
      await options.onSuccess?.(result);
    },
  });
}

export function useRespondAttendance(options: MutationOptions<Awaited<ReturnType<typeof respondAttendanceAction>>> = {}) {
  return useAttendanceMutation<AttendanceResponseInput>(respondAttendanceAction, options);
}

export function useActivateAttendance(options: MutationOptions<Awaited<ReturnType<typeof activateAttendanceAction>>> = {}) {
  return useAttendanceMutation<AttendanceActivationInput>(activateAttendanceAction, options);
}

export function useCorrectAttendance(options: MutationOptions<Awaited<ReturnType<typeof correctAttendanceAction>>> = {}) {
  return useAttendanceMutation<AttendanceCorrectionInput>(correctAttendanceAction, options);
}

export function useReviewAttendanceCorrection(options: MutationOptions<Awaited<ReturnType<typeof reviewAttendanceCorrectionAction>>> = {}) {
  return useAttendanceMutation<AttendanceCorrectionReviewInput>(reviewAttendanceCorrectionAction, options);
}
