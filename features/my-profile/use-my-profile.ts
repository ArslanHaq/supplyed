"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";
import type { MyJobs } from "@/features/jobs/types";
import type { MyProfileReviews, ProfileApplications, ProfilePageQuery, ReviewDirection } from "./types";

export function useProfileJobs(query: ProfilePageQuery, enabled: boolean) {
  return useQuery({ enabled, placeholderData: keepPreviousData, queryKey: queryKeys.jobs.mine(query), queryFn: () => fetchJson<MyJobs>("/api/jobs/mine", { query }) });
}

export function useProfileApplications(query: ProfilePageQuery) {
  return useQuery({ placeholderData: keepPreviousData, refetchOnMount: "always", queryKey: [...queryKeys.applications.all, "my-profile", query], queryFn: () => fetchJson<ProfileApplications>("/api/my-profile/applications", { query }) });
}

export function useProfileReviews(query: ProfilePageQuery & { direction: ReviewDirection }) {
  return useQuery({ refetchOnMount: "always", queryKey: [...queryKeys.bookings.all, "my-profile-reviews", query], queryFn: () => fetchJson<MyProfileReviews>("/api/my-profile/reviews", { query }) });
}
