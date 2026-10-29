"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";

import type { InstitutionPublicProfile, InstructorPublicProfile } from "./types";

export function useInstructorPublicProfile(id: string | undefined) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: ({ signal }) => fetchJson<InstructorPublicProfile>(`/api/instructors/profile/${id}`, { signal }),
    queryKey: queryKeys.publicProfiles.instructor(id ?? ""),
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

export function useInstitutionPublicProfile(id: string | undefined) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: ({ signal }) => fetchJson<InstitutionPublicProfile>(`/api/institutions/profile/${id}`, { signal }),
    queryKey: queryKeys.publicProfiles.institution(id ?? ""),
  });
}
