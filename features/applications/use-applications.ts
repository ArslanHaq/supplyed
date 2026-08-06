"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";

import type { JobApplicationsQuery, PaginatedApplications } from "./types";

export function useJobApplications(jobId: string | undefined, query: JobApplicationsQuery = {}) {
  return useQuery({
    enabled: Boolean(jobId),
    queryFn: () => fetchJson<PaginatedApplications>(`/api/applications/job/${jobId}`, { query }),
    queryKey: queryKeys.applications.byJob(jobId ?? "", query),
  });
}
