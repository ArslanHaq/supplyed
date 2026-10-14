import "server-only";

import { api } from "@/lib/server/api-client";

import { normalizeMatch, normalizeMatchQuery, normalizeRankedApplications, normalizeRecommendedInstructors, normalizeRecommendedJobs } from "./schemas";
import type {
  BackendRecommendedJobsPage,
  MatchListQuery,
  MatchResult,
  RankedApplicationsPage,
  RecommendedInstructorsPage,
  RecommendedJobsPage,
} from "./types";

export async function getRankedApplications(jobId: string, query: MatchListQuery = {}) {
  const result = await api.get<RankedApplicationsPage>(`/matching/jobs/${jobId}/applications`, { cache: "no-store", query: normalizeMatchQuery(query) });
  return normalizeRankedApplications(result);
}

export async function getRecommendedInstructors(jobId: string, query: MatchListQuery = {}) {
  const result = await api.get<RecommendedInstructorsPage>(`/matching/jobs/${jobId}/instructors`, { cache: "no-store", query: normalizeMatchQuery(query) });
  return normalizeRecommendedInstructors(result);
}

export async function getRecommendedJobs(query: MatchListQuery = {}): Promise<RecommendedJobsPage> {
  const result = await api.get<BackendRecommendedJobsPage>("/matching/jobs/recommended", { cache: "no-store", query: normalizeMatchQuery(query) });
  return normalizeRecommendedJobs(result);
}

export async function getJobMatchScore(jobId: string) {
  return normalizeMatch(await api.get<MatchResult>(`/matching/jobs/${jobId}/score`, { cache: "no-store" }));
}
