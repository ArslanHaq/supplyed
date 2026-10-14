"use server";

import { revalidateTag } from "next/cache";

import { actionError, actionOk } from "@/lib/server/action-response";
import { api, ApiError } from "@/lib/server/api-client";

import { normalizeBooking, normalizeReviewInput } from "./schemas";
import type { Booking, BookingReview, BookingReviewInput, BookingStatusUpdateInput } from "./types";

const bookingActionPath = {
  cancel: "cancel",
  complete: "complete",
  "no-show": "no-show",
} satisfies Record<BookingStatusUpdateInput["action"], string>;

export async function updateBookingStatusAction(input: BookingStatusUpdateInput) {
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
    return actionError(readBookingError(error), { code: error instanceof ApiError ? error.code : undefined });
  }
}

export async function createBookingReviewAction(input: BookingReviewInput) {
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
    return actionError(readBookingError(error), { code: error instanceof ApiError ? error.code : undefined });
  }
}

function readBookingError(error: unknown) {
  if (error instanceof ApiError && error.message) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Booking could not be updated. Please try again.";
}
