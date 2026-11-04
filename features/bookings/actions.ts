"use server";

import { revalidateTag } from "next/cache";

import { actionError, actionOk } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";

import { normalizeBooking, normalizeReviewInput } from "./schemas";
import type {
  AttendanceActivationInput,
  AttendanceCorrectionInput,
  AttendanceCorrectionReviewInput,
  AttendanceResponseInput,
  Booking,
  BookingReview,
  BookingReviewInput,
  BookingStatusUpdateInput,
} from "./types";

const bookingActionPath = {
  cancel: "cancel",
  complete: "complete",
  "no-show": "no-show",
} satisfies Record<BookingStatusUpdateInput["action"], string>;

/** Re-evaluates this booking's payment eligibility and reads its current Stripe status. */
export async function syncBookingPaymentAction(bookingId: string) {
  const id = typeof bookingId === "string" ? bookingId.trim() : "";
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) return actionError("Choose a valid booking.");
  try {
    const booking = await api.post<Booking>(`/bookings/${id}/payment-sync`);
    revalidateTag("bookings", "max");
    revalidateTag("invoices", "max");
    revalidateTag("school-billing", "max");
    return actionOk(normalizeBooking(booking), "Payment status checked.");
  } catch (error) {
    return actionError(readBookingError(error), { code: error instanceof ApiError ? error.code : undefined, requestId: error instanceof ApiError ? error.requestId : undefined });
  }
}

export async function updateBookingStatusAction(input: BookingStatusUpdateInput) {
  if (!input || typeof input.id !== "string" || !Object.hasOwn(bookingActionPath, input.action) || (input.reason !== undefined && typeof input.reason !== "string")) return actionError("Choose a valid booking action.");
  const id = input.id.trim();
  if (!id) return actionError("Choose a valid booking.", { code: "BOOKING_ID_REQUIRED" });

  if (input.action === "cancel") {
    const reason = input.reason?.trim() ?? "";
    if (!reason) return actionError("Add a cancellation reason.", { code: "CANCEL_REASON_REQUIRED" });
    if (reason.length > 1000) return actionError("Cancellation reason must be 1,000 characters or fewer.", { code: "CANCEL_REASON_TOO_LONG" });
  }

  try {
    const booking = await api.patch<Booking>(
      `/bookings/${id}/${bookingActionPath[input.action]}`,
      input.action === "cancel" ? { reason: input.reason?.trim() } : undefined,
    );

    revalidateTag("bookings", "max");
    return actionOk(normalizeBooking(booking), "Booking updated.");
  } catch (error) {
    return actionError(readBookingError(error), { code: error instanceof ApiError ? error.code : undefined, status: error instanceof ApiError ? error.status : undefined, fieldErrors: error instanceof ApiError ? error.fieldErrors : undefined, retryAfter: error instanceof ApiError ? error.retryAfter : undefined, requestId: error instanceof ApiError ? error.requestId : undefined });
  }
}

export async function createBookingReviewAction(input: BookingReviewInput) {
  if (!input || typeof input.bookingId !== "string" || !Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5 || (input.comment !== undefined && typeof input.comment !== "string")) return actionError("Choose a rating from 1 to 5 and enter a valid review.", { fieldErrors: { rating: "Choose a rating from 1 to 5." } });
  const normalized = normalizeReviewInput(input);
  if (!normalized.bookingId) return actionError("Choose a valid booking.", { code: "BOOKING_ID_REQUIRED" });
  if (normalized.rating < 1 || normalized.rating > 5) return actionError("Choose a rating from 1 to 5.", { code: "RATING_REQUIRED" });
  if (normalized.comment && normalized.comment.length > 2000) {
    return actionError("Review comment must be 2,000 characters or fewer.", { code: "REVIEW_TOO_LONG" });
  }

  try {
    const review = await api.post<BookingReview>("/reviews", normalized);
    revalidateTag("bookings", "max");
    return actionOk(review, "Review submitted.");
  } catch (error) {
    return actionError(readBookingError(error), { code: error instanceof ApiError ? error.code : undefined, status: error instanceof ApiError ? error.status : undefined, fieldErrors: error instanceof ApiError ? error.fieldErrors : undefined, retryAfter: error instanceof ApiError ? error.retryAfter : undefined, requestId: error instanceof ApiError ? error.requestId : undefined });
  }
}

export async function respondAttendanceAction(input: AttendanceResponseInput) {
  if (!input?.bookingId || !input.shiftId || !["PRESENT", "ABSENT"].includes(input.status)) return actionError("Choose a valid attendance response.");
  try {
    const booking = await api.patch<Booking>(`/bookings/${input.bookingId}/attendance/${input.shiftId}`, {
      status: input.status,
      reason: input.reason?.trim() || undefined,
    });
    revalidateTag("bookings", "max");
    return actionOk(normalizeBooking(booking), "Attendance saved.");
  } catch (error) {
    return actionError(readBookingError(error), { code: error instanceof ApiError ? error.code : undefined, status: error instanceof ApiError ? error.status : undefined });
  }
}

export async function activateAttendanceAction(input: AttendanceActivationInput) {
  if (!input?.bookingId) return actionError("Choose a valid booking.");
  try {
    const booking = await api.post<Booking>(`/bookings/${input.bookingId}/attendance/activate`);
    revalidateTag("bookings", "max");
    return actionOk(normalizeBooking(booking), "Attendance tracking started.");
  } catch (error) {
    return actionError(readBookingError(error), { code: error instanceof ApiError ? error.code : undefined, status: error instanceof ApiError ? error.status : undefined });
  }
}

export async function correctAttendanceAction(input: AttendanceCorrectionInput) {
  if (!input?.bookingId || !input.shiftId || !["PRESENT", "ABSENT"].includes(input.status) || input.reason.trim().length < 3) return actionError("Add a correction reason and attendance status.");
  try {
    const booking = await api.patch<Booking>(`/bookings/${input.bookingId}/attendance/${input.shiftId}/correct`, {
      status: input.status,
      reason: input.reason.trim(),
    });
    revalidateTag("bookings", "max");
    return actionOk(normalizeBooking(booking), "Attendance corrected.");
  } catch (error) {
    return actionError(readBookingError(error), { code: error instanceof ApiError ? error.code : undefined, status: error instanceof ApiError ? error.status : undefined });
  }
}

export async function reviewAttendanceCorrectionAction(input: AttendanceCorrectionReviewInput) {
  if (!input?.bookingId || !input.requestId || !["APPROVED", "REJECTED"].includes(input.decision) || input.reason.trim().length < 3) return actionError("Add a review reason and decision.");
  try {
    const booking = await api.patch<Booking>(`/bookings/${input.bookingId}/attendance/correction-requests/${input.requestId}`, {
      decision: input.decision,
      reason: input.reason.trim(),
    });
    revalidateTag("bookings", "max");
    return actionOk(normalizeBooking(booking), "Correction request reviewed.");
  } catch (error) {
    return actionError(readBookingError(error), { code: error instanceof ApiError ? error.code : undefined, status: error instanceof ApiError ? error.status : undefined });
  }
}

function readBookingError(error: unknown) {
  if (error instanceof ApiError && error.message) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Booking could not be updated. Please try again.";
}
