import type {
  Booking,
  BookingInvoiceSummary,
  BookingListQuery,
  BookingReview,
  BookingReviewInput,
  BookingStatus,
  PaginatedBookings,
  ReviewerType,
} from "./types";

const bookingStatuses = new Set<BookingStatus>(["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]);
const reviewerTypes = new Set<ReviewerType>(["INSTITUTION", "INSTRUCTOR"]);

function readDateIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

function normalizeReview(review: BookingReview): BookingReview {
  return {
    ...review,
    bookingId: review.bookingId ?? "",
    comment: review.comment ?? null,
    createdAt: readDateIso(review.createdAt),
    id: review.id ?? "",
    rating: readNumber(review.rating) ?? 0,
    reviewerType: reviewerTypes.has(review.reviewerType) ? review.reviewerType : "INSTITUTION",
    updatedAt: readDateIso(review.updatedAt),
  };
}

const invoiceStatuses = new Set<BookingInvoiceSummary["status"]>(["OPEN", "PAID", "UNCOLLECTIBLE"]);

function normalizeInvoiceStatus(invoice: BookingInvoiceSummary): BookingInvoiceSummary["status"] | null {
  if (readDateIso(invoice.paidAt)) return "PAID";

  const status = typeof invoice.status === "string" ? invoice.status.toUpperCase() : "";
  return invoiceStatuses.has(status as BookingInvoiceSummary["status"])
    ? status as BookingInvoiceSummary["status"]
    : null;
}

function normalizeInvoiceSummary(invoice: BookingInvoiceSummary | null | undefined): BookingInvoiceSummary | null {
  if (!invoice?.id) return null;

  const paidAt = readDateIso(invoice.paidAt);
  const status = normalizeInvoiceStatus(invoice);
  if (!status) return null;

  return {
    dueAt: readDateIso(invoice.dueAt),
    hostedInvoiceUrl: invoice.hostedInvoiceUrl ?? null,
    id: invoice.id,
    paidAt,
    status,
    totalAmountPence: readNumber(invoice.totalAmountPence) ?? 0,
  };
}

export function normalizeBooking(booking: Booking): Booking {
  return {
    ...booking,
    cancelReason: booking.cancelReason ?? null,
    cancelledAt: readDateIso(booking.cancelledAt),
    completedAt: readDateIso(booking.completedAt),
    createdAt: readDateIso(booking.createdAt),
    endDate: readDateIso(booking.endDate),
    job: {
      ...booking.job,
      address: booking.job?.address ?? null,
      city: booking.job?.city ?? null,
      county: booking.job?.county ?? null,
      description: booking.job?.description ?? null,
      id: booking.job?.id ?? "",
      keyStages: readStringArray(booking.job?.keyStages),
      parkingInfo: booking.job?.parkingInfo ?? null,
      postalCode: booking.job?.postalCode ?? null,
      subject: booking.job?.subject ?? null,
      title: booking.job?.title ?? "Booking",
    },
    institution: {
      id: booking.institution?.id ?? "",
      imageUrl: booking.institution?.imageUrl ?? null,
      name: booking.institution?.name ?? "School",
    },
    instructor: {
      fullName: booking.instructor?.fullName ?? "Teacher",
      id: booking.instructor?.id ?? "",
      imageUrl: booking.instructor?.imageUrl ?? null,
    },
    invoice: normalizeInvoiceSummary(booking.invoice),
    payAmount: readNumber(booking.payAmount),
    payType: booking.payType ?? null,
    reviews: Array.isArray(booking.reviews) ? booking.reviews.map(normalizeReview) : [],
    startDate: readDateIso(booking.startDate),
    status: bookingStatuses.has(booking.status) ? booking.status : "CONFIRMED",
    updatedAt: readDateIso(booking.updatedAt),
  };
}

export function normalizePaginatedBookings(payload: PaginatedBookings): PaginatedBookings {
  return {
    bookings: (payload.bookings ?? []).map(normalizeBooking),
    pagination: {
      hasNextPage: Boolean(payload.pagination?.hasNextPage),
      limit: payload.pagination?.limit ?? 20,
      page: payload.pagination?.page ?? 1,
      total: payload.pagination?.total ?? 0,
      totalPages: payload.pagination?.totalPages ?? 0,
    },
  };
}

export function normalizeBookingsQuery(query: BookingListQuery = {}): BookingListQuery {
  return {
    limit: query.limit && Number.isFinite(query.limit) ? Math.min(100, Math.max(1, query.limit)) : 20,
    page: query.page && Number.isFinite(query.page) ? Math.max(1, query.page) : 1,
    status: query.status && bookingStatuses.has(query.status) ? query.status : undefined,
  };
}

export function normalizeReviewInput(input: BookingReviewInput): BookingReviewInput {
  return {
    bookingId: input.bookingId.trim(),
    comment: input.comment?.trim() || undefined,
    rating: Math.min(5, Math.max(1, Math.round(input.rating))),
  };
}

/** Booking dates count both start and end; use UTC calendar days across DST changes. */
export function bookingDays(booking: Pick<Booking, "startDate" | "endDate">): number | null {
  if (!booking.startDate || !booking.endDate) return null;
  const start = new Date(booking.startDate);
  const end = new Date(booking.endDate);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return null;
  const day = 24 * 60 * 60 * 1000;
  return Math.floor((Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()) - Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())) / day) + 1;
}

export function invoiceUnitsLimit(booking: Pick<Booking, "startDate" | "endDate" | "payType">): number {
  const days = bookingDays(booking);
  return Math.min(9999.99, days === null ? 9999.99 : booking.payType === "hourly" ? days * 24 : days);
}
