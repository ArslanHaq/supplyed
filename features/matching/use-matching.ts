"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";

import type { MatchListQuery, MatchResult, RankedApplicationsPage, RecommendedInstructorsPage, RecommendedJobsPage } from "./types";

export function useRankedApplications(jobId: string | undefined, query: MatchListQuery = {}) {
  return useQuery({ enabled: Boolean(jobId), queryFn: ({ signal }) => fetchJson<RankedApplicationsPage>(`/api/matching/jobs/${jobId}/applications`, { query, signal }), queryKey: queryKeys.matching.applications(jobId ?? "", query) });
}

export function useRecommendedInstructors(jobId: string | undefined, query: MatchListQuery = {}) {
  return useQuery({ enabled: Boolean(jobId), queryFn: ({ signal }) => fetchJson<RecommendedInstructorsPage>(`/api/matching/jobs/${jobId}/instructors`, { query, signal }), queryKey: queryKeys.matching.instructors(jobId ?? "", query) });
}

export function useRecommendedJobs(query: MatchListQuery = {}, enabled = true) {
  return useQuery({ enabled, queryFn: ({ signal }) => fetchJson<RecommendedJobsPage>("/api/matching/jobs/recommended", { query, signal }), queryKey: queryKeys.matching.recommendedJobs(query) });
}

export function useJobMatchScore(jobId: string, enabled = true) {
  return useQuery({ enabled: enabled && Boolean(jobId), queryFn: ({ signal }) => fetchJson<MatchResult>(`/api/matching/jobs/${jobId}/score`, { signal }), queryKey: queryKeys.matching.score(jobId), retry: false });
}
