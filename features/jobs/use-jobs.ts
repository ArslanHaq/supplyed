"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";

import { createJobAction, deleteJobAction, updateJobAction } from "./actions";
import type { Job, JobCreateInput, JobListFilters, JobUpdateInput } from "./types";

type CreateJobResult = Awaited<ReturnType<typeof createJobAction>>;
type UpdateJobResult = Awaited<ReturnType<typeof updateJobAction>>;
type DeleteJobResult = Awaited<ReturnType<typeof deleteJobAction>>;

type UseCreateJobOptions = {
  onError?: () => void;
  onSuccess?: (result: CreateJobResult) => void | Promise<void>;
};

type UseUpdateJobOptions = {
  onError?: () => void;
  onSuccess?: (result: UpdateJobResult) => void | Promise<void>;
};

type UseDeleteJobOptions = {
  onError?: () => void;
  onSuccess?: (result: DeleteJobResult) => void | Promise<void>;
};

export function useJobs(filters: JobListFilters = {}) {
  return useQuery({
    queryFn: () => fetchJson<Job[]>("/api/jobs", { query: filters }),
    queryKey: queryKeys.jobs.list(filters),
  });
}

export function useMyJobs(filters: JobListFilters = {}) {
  return useQuery({
    queryFn: () => fetchJson<Job[]>("/api/jobs/mine", { query: filters }),
    queryKey: queryKeys.jobs.mine(filters),
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

export function useUpdateJob(options: UseUpdateJobOptions = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: JobUpdateInput) => updateJobAction(input),
    onError: options.onError,
    onSuccess: async (result) => {
      if (result.ok) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      }

      await options.onSuccess?.(result);
    },
  });
}

export function useDeleteJob(options: UseDeleteJobOptions = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteJobAction(id),
    onError: options.onError,
    onSuccess: async (result) => {
      if (result.ok) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      }

      await options.onSuccess?.(result);
    },
  });
}
