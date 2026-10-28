import type { JobApplication } from "@/features/applications/types";
import type { BookingReview } from "@/features/bookings/types";

export type ProfilePagination = { page: number; limit: number; total: number; totalPages: number; hasNextPage: boolean };
export type ProfilePageQuery = { page: number; limit: number };
export type ProfileApplication = JobApplication & { jobTitle: string | null; schoolName: string | null; jobAvailable: boolean };
export type ProfileApplications = { applications: ProfileApplication[]; pagination: ProfilePagination };
export type ReviewDirection = "received" | "given";
export type MyProfileReview = BookingReview & {
  direction: ReviewDirection;
  jobId: string;
  partyId: string;
  partyName: string;
};
export type MyProfileReviews = {
  reviews: MyProfileReview[];
  pagination: ProfilePagination;
  receivedTotal: number;
  givenTotal: number;
  averageReceived: number | null;
};
