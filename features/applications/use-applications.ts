"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";

import type {
  CreateApplicationInput,
  JobApplication,
  JobApplicationsQuery,
  PaginatedApplications,
  UpdateApplicationStatusInput,
} from "./types";

export function useJobApplications(jobId: string | undefined, query: JobApplicationsQuery = {}) {
  return useQuery({
    enabled: Boolean(jobId),
    queryFn: () => fetchJson<PaginatedApplications>(`/api/applications/job/${jobId}`, { query }),
    queryKey: queryKeys.applications.byJob(jobId ?? "", query),
  });
}

export function useMyApplications(query: JobApplicationsQuery = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    enabled: options.enabled ?? true,
    queryFn: () => fetchJson<PaginatedApplications>("/api/applications/me", { query }),
    queryKey: queryKeys.applications.mine(query),
  });
}

export function useCreateApplication(options: { onError?: (error: Error) => void; onSuccess?: (application: JobApplication) => void | Promise<void> } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateApplicationInput) =>
      fetchJson<JobApplication>("/api/applications", {
        body: input,
        method: "POST",
      }),
    onError: (error) => options.onError?.(error instanceof Error ? error : new Error("Application could not be submitted.")),
    onSuccess: async (application) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.applications.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all }),
      ]);
      await options.onSuccess?.(application);
    },
  });
}

export function useUpdateApplicationStatus(
  options: { onError?: (error: Error) => void; onSuccess?: (application: JobApplication) => void | Promise<void> } = {},
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateApplicationStatusInput) =>
      fetchJson<JobApplication>(`/api/applications/${input.id}/status`, {
        body: { status: input.status },
        method: "PATCH",
      }),
    onError: (error) => options.onError?.(error instanceof Error ? error : new Error("Application status could not be updated.")),
    onSuccess: async (application) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.applications.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all }),
      ]);
      await options.onSuccess?.(application);
    },
  });
}
