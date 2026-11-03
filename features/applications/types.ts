import type { OfferedJobTerms } from "@/features/jobs/offered-terms";
import type { JobPayType, PaymentFrequency } from "@/types/supplyed";
export type JobApplicationStatus = "APPLIED" | "HIRED" | "REJECTED" | "SHORTLISTED" | "VIEWED";

export type ApplicantSummary = {
  city?: string | null;
  county?: string | null;
  dbsVerified: boolean;
  experience?: number | null;
  fullName: string;
  id: string;
  imageUrl?: string | null;
  keyStages: string[];
  ratingAverage: number;
  ratingCount: number;
  skills: string[];
  subjects: string[];
};

export type JobApplication = {
  agreedTerms: OfferedJobTerms | null;
  /** Final immutable booking terms. Present after a successful hire. */
  bookingTerms?: OfferedJobTerms | null;
  termsStatus: "RECORDED" | "LEGACY_UNVERIFIED";
  /** Other active applications rejected atomically when this application was hired. */
  automaticallyRejectedCount?: number;
  scheduleConflict?: {
    available: false;
    conflicts: Array<{ date: string; start: string; end: string; type: "OUTSIDE_AVAILABILITY" | "BOOKING_CONFLICT" }>;
  } | null;
  coverLetter?: string | null;
  createdAt?: string | null;
  id: string;
  instructor?: ApplicantSummary;
  instructorId: string;
  jobId: string;
  /** The backend saves the job's title when the application is submitted. */
  jobName?: string | null;
  school?: { id: string; name: string; imageUrl?: string | null } | null;
  bookingId?: string | null;
  conversationId?: string | null;
  jobDetails?: {
    description: string;
    subject: string | null;
    city: string | null;
    county: string | null;
    postalCode: string | null;
    startDate: string | null;
    endDate: string | null;
    payAmount: number | null;
    payType: string | null;
  } | null;
  status: JobApplicationStatus;
  updatedAt?: string | null;
};

export type ApplicationCreateInput = {
  coverLetter?: string;
  jobId: string;
};

export type ApplicationStatusUpdateInput = { id: string; status: JobApplicationStatus };

export type BookingPaymentOverrides = {
  days?: number;
  hours?: number;
  payAmount?: number;
  paymentFrequency?: PaymentFrequency;
  payType?: JobPayType;
  periodAnchor?: "ASSIGNMENT_START" | "CALENDAR";
};

export type HireApplicationInput = BookingPaymentOverrides & { id: string };

export type ApplicationsPagination = {
  hasNextPage: boolean;
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

export type PaginatedApplications = {
  applications: JobApplication[];
  pagination: ApplicationsPagination;
};

export type ApplicationHistoryEntry = {
  applicationId: string;
  changedBy: string;
  createdAt: string;
  fromStatus: JobApplicationStatus | null;
  id: string;
  toStatus: JobApplicationStatus;
};

export type PaginatedApplicationHistory = {
  history: ApplicationHistoryEntry[];
  pagination: ApplicationsPagination;
};

export type JobApplicationsQuery = {
  jobId?: string;
  limit?: number;
  page?: number;
  status?: JobApplicationStatus;
};
