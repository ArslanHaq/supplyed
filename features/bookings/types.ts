export type BookingStatus = "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
export type BookingInvoiceFilter = "none" | "paid" | "unpaid";
export type ReviewerType = "INSTITUTION" | "INSTRUCTOR";

export type BookingReview = {
  bookingId: string;
  comment?: string | null;
  createdAt?: string | null;
  id: string;
  jobTitle?: string;
  rating: number;
  reviewerName?: string;
  reviewerType: ReviewerType;
  updatedAt?: string | null;
};

export type BookingJobSummary = {
  address?: string | null;
  city?: string | null;
  county?: string | null;
  description?: string | null;
  id: string;
  keyStages: string[];
  parkingInfo?: string | null;
  postalCode?: string | null;
  subject?: string | null;
  title: string;
};

export type BookingPartySummary = {
  fullName?: string;
  id: string;
  imageUrl?: string | null;
  name?: string;
};

/** The booking's current invoice: none until the school invoices it, and never one still being created or voided. */
export type BookingInvoiceSummary = {
  dueAt?: string | null;
  hostedInvoiceUrl?: string | null;
  id: string;
  paidAt?: string | null;
  status: "OPEN" | "PAID" | "UNCOLLECTIBLE";
  totalAmountPence: number;
};

export type Booking = {
  applicationId: string;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  cancelledById?: string | null;
  completedAt?: string | null;
  createdAt?: string | null;
  endDate?: string | null;
  id: string;
  institution: BookingPartySummary;
  instructor: BookingPartySummary;
  invoice: BookingInvoiceSummary | null;
  job: BookingJobSummary;
  payAmount?: number | null;
  payType?: string | null;
  reviews: BookingReview[];
  startDate?: string | null;
  status: BookingStatus;
  updatedAt?: string | null;
};

export type BookingsPagination = {
  hasNextPage: boolean;
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

export type PaginatedBookings = {
  bookings: Booking[];
  pagination: BookingsPagination;
};

export type BookingListQuery = {
  from?: string;
  invoice?: BookingInvoiceFilter;
  jobId?: string;
  limit?: number;
  page?: number;
  search?: string;
  status?: BookingStatus;
  to?: string;
};

export type BookingStatusAction = "cancel" | "complete" | "no-show";

export type BookingStatusUpdateInput = {
  action: BookingStatusAction;
  id: string;
  reason?: string;
};

export type BookingReviewInput = {
  bookingId: string;
  comment?: string;
  rating: number;
};
