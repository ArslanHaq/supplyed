"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";

import { createJobAction } from "./actions";
import type { Job, JobCreateInput, JobListFilters } from "./types";

type CreateJobResult = Awaited<ReturnType<typeof createJobAction>>;

type UseCreateJobOptions = {
  onError?: () => void;
  onSuccess?: (result: CreateJobResult) => void | Promise<void>;
};

export function useJobs(filters: JobListFilters = {}) {
  return useQuery({
    queryFn: () => fetchJson<Job[]>("/api/jobs", { query: filters }),
    queryKey: queryKeys.jobs.list(filters),
  });
}

export function useJob(id: string) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: () => fetchJson<Job>(`/api/jobs/${id}`),
    queryKey: queryKeys.jobs.detail(id),
  });
}

export function useCreateJob(options: UseCreateJobOptions = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: JobCreateInput) => createJobAction(input),
    onError: options.onError,
    onSuccess: async (result) => {
      if (result.ok) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      }

      await options.onSuccess?.(result);
    },
  });
}
