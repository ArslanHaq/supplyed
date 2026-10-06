"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { signOut } from "next-auth/react";

import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";
import { startRouteLoading } from "@/lib/navigation-loading";

import { createJobAction, deleteJobAction, updateJobAction } from "./actions";
import type { Job, JobCreateInput, JobListFilters, JobUpdateInput, MyJobs, PaginatedJobs } from "./types";

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

function signOutExpiredSession() {
  startRouteLoading();
  void signOut({ redirect: false }).finally(() => {
    window.location.assign("/login");
  });
}

function handleSessionExpiredResult(result: CreateJobResult | DeleteJobResult | UpdateJobResult) {
  if (!result.ok && result.code === "SESSION_EXPIRED") {
    signOutExpiredSession();
    return true;
  }

  return false;
}

/** One page of the job board; the previous page stays on screen while the next one loads. */
export function useJobs(filters: JobListFilters = {}) {
  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: () => fetchJson<PaginatedJobs>("/api/jobs", { query: filters }),
    queryKey: queryKeys.jobs.list(filters),
  });
}

/** One page of the poster's own jobs, plus how many are in each status. */
export function useMyJobs(filters: JobListFilters = {}) {
  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: () => fetchJson<MyJobs>("/api/jobs/mine", { query: filters }),
    queryKey: queryKeys.jobs.mine(filters),
  });
}

export function useJob(id: string, ownerView = false) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: () => fetchJson<Job>(`/api/jobs/${id}`, ownerView ? { query: { scope: "mine" } } : undefined),
    queryKey: [...queryKeys.jobs.detail(id), ownerView ? "mine" : "public"],
  });
}

export function useCreateJob(options: UseCreateJobOptions = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: JobCreateInput) => createJobAction(input),
    onError: options.onError,
    onSuccess: async (result) => {
      if (handleSessionExpiredResult(result)) return;

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
      if (handleSessionExpiredResult(result)) return;

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
      if (handleSessionExpiredResult(result)) return;

      if (result.ok) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      }

      await options.onSuccess?.(result);
    },
  });
}
