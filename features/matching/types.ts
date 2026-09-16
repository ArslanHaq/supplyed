import type { ApplicantSummary, ApplicationsPagination, JobApplication } from "@/features/applications/types";
import type { BackendJobResponse, Job } from "@/features/jobs/types";

export type MatchFactor = {
  applicable: boolean;
  detail: string;
  key: string;
  label: string;
  value: number;
  weight: number;
};

export type MatchResult = {
  distanceMiles: number | null;
  factors: MatchFactor[];
  flags: {
    distanceKnown: boolean;
    outsideTravelRadius: boolean;
    scheduleConflict: boolean;
  };
  score: number;
};

export type MatchListQuery = { limit?: number; minScore?: number; page?: number };
export type MatchedInstructor = ApplicantSummary & {
  currency?: string | null;
  dailyRate?: number | null;
  hourlyRate?: number | null;
  maxTravelDistance?: number | null;
};

export type RankedApplication = { application: JobApplication; instructor: MatchedInstructor; match: MatchResult };
export type RecommendedInstructor = { instructor: MatchedInstructor; match: MatchResult };
export type RecommendedJob = { job: Job; match: MatchResult };

export type RankedApplicationsPage = { applications: RankedApplication[]; pagination: ApplicationsPagination };
export type RecommendedInstructorsPage = { instructors: RecommendedInstructor[]; pagination: ApplicationsPagination };
export type RecommendedJobsPage = { jobs: RecommendedJob[]; pagination: ApplicationsPagination };

export type BackendRecommendedJobsPage = {
  jobs: Array<{ job: BackendJobResponse; match: MatchResult }>;
  pagination: ApplicationsPagination;
};
