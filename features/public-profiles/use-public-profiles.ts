"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";

import type { InstitutionPublicProfile, InstructorPublicProfile } from "./types";

export function useInstructorPublicProfile(id: string | undefined) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: () => fetchJson<InstructorPublicProfile>(`/api/instructors/profile/${id}`),
    queryKey: queryKeys.publicProfiles.instructor(id ?? ""),
  });
}

export function useInstitutionPublicProfile(id: string | undefined) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: () => fetchJson<InstitutionPublicProfile>(`/api/institutions/profile/${id}`),
    queryKey: queryKeys.publicProfiles.institution(id ?? ""),
  });
}
