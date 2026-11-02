import type { OfferedJobTerms } from "@/features/jobs/offered-terms";
import type { JobSchedule, PaymentFrequency } from "@/types/supplyed";
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
  subjects?: string[];
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
  teacherAmountPence: number;
};

export type AttendanceStatus = "AWAITING_CONFIRMATION" | "PRESENT" | "ABSENT";
export type AttendanceDecisionSource = "TEACHER" | "SCHOOL" | "ADMIN" | "SYSTEM_NO_RESPONSE";
export type AttendanceCorrectionStatus = "PENDING" | "APPROVED" | "REJECTED";

export type AttendanceCorrectionRequest = {
  id: string;
  requestedById: string;
  requestedStatus: AttendanceStatus;
  reason: string;
  status: AttendanceCorrectionStatus;
  reviewedById?: string | null;
  reviewReason?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
};

export type AttendanceShift = {
  id: string;
  workDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  timeZone: string;
  status: AttendanceStatus;
  decisionSource?: AttendanceDecisionSource | null;
  reason?: string | null;
  notifiedAt?: string | null;
  responseDeadline?: string | null;
  decidedAt?: string | null;
  correctionRequests: AttendanceCorrectionRequest[];
  audits: Array<{
    id: string;
    actorUserId?: string | null;
    fromStatus?: AttendanceStatus | null;
    toStatus: AttendanceStatus;
    fromSource?: AttendanceDecisionSource | null;
    toSource?: AttendanceDecisionSource | null;
    reason?: string | null;
    createdAt: string;
  }>;
};

export type AttendancePayroll = {
  covered: boolean;
  currency: string;
  payType?: string | null;
  paymentFrequency?: string | null;
  estimatedAmountPence: number;
  payableAmountPence: number;
  pendingAmountPence: number;
  excludedAmountPence: number;
  reviewAmountPence: number;
  payableMinutes: number;
  payableDays: number;
  paidAmountPence: number;
  adjustmentDuePence: number;
  exclusions: Array<{ shiftId?: string | null; date: string; amountPence: number; reason: string }>;
  periods: Array<{
    key: string;
    label: string;
    estimatedAmountPence: number;
    payableAmountPence: number;
    pendingAmountPence: number;
    excludedAmountPence: number;
    reviewAmountPence: number;
  }>;
};

export type Booking = {
  agreedTerms: OfferedJobTerms | null;
  termsStatus: "RECORDED" | "LEGACY_PARTIAL";
  source?: "APPLICATION" | "DIRECT_HIRE";
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
  hours?: number | null;
  days?: number | null;
  payAmount?: number | null;
  payType?: string | null;
  currency?: string;
  paymentFrequency?: PaymentFrequency | string | null;
  periodAnchor?: "ASSIGNMENT_START" | "CALENDAR" | string;
  timeZone?: string;
  schedule?: JobSchedule | null;
  scheduledMinutes?: number | null;
  attendancePolicyEffectiveAt?: string | null;
  attendanceShifts: AttendanceShift[];
  attendancePayroll?: AttendancePayroll | null;
  attendanceAdjustments: Array<{
    id: string;
    shiftId: string;
    amountPence: number;
    reason: string;
    status: "PENDING_REVIEW" | "SETTLED";
    createdAt: string;
  }>;
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

export type AttendanceResponseInput = {
  bookingId: string;
  shiftId: string;
  status: "PRESENT" | "ABSENT";
  reason?: string;
};

export type AttendanceActivationInput = {
  bookingId: string;
};

export type AttendanceCorrectionRequestInput = {
  bookingId: string;
  shiftId: string;
  requestedStatus: "PRESENT" | "ABSENT";
  reason: string;
};

export type AttendanceCorrectionInput = {
  bookingId: string;
  shiftId: string;
  status: "PRESENT" | "ABSENT";
  reason: string;
};

export type AttendanceCorrectionReviewInput = {
  bookingId: string;
  requestId: string;
  decision: "APPROVED" | "REJECTED";
  reason: string;
};
