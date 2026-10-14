"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";

import type { ProfileReviews } from "./types";

export function useInstructorReviews(instructorId?: string | null) {
  const id = instructorId ?? "";

  return useQuery({
    enabled: Boolean(id),
    queryFn: () => fetchJson<ProfileReviews>(`/api/reviews/instructor/${encodeURIComponent(id)}`),
    queryKey: queryKeys.reviews.instructor(id),
  });
}

export function useInstitutionReviews(institutionId?: string | null) {
  const id = institutionId ?? "";

  return useQuery({
    enabled: Boolean(id),
    queryFn: () => fetchJson<ProfileReviews>(`/api/reviews/institution/${encodeURIComponent(id)}`),
    queryKey: queryKeys.reviews.institution(id),
  });
}
