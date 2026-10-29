"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { signOut } from "next-auth/react";

import { fetchJson } from "@/lib/query/fetch-json";
import { refreshMarketplace } from "@/lib/query/marketplace";
import { queryKeys } from "@/lib/query/keys";
import { startRouteLoading } from "@/lib/navigation-loading";

import { createApplicationAction, updateApplicationStatusAction } from "./actions";
import type { ApplicationCreateInput, ApplicationStatusUpdateInput, JobApplication, JobApplicationsQuery, PaginatedApplicationHistory, PaginatedApplications } from "./types";

type CreateApplicationResult = Awaited<ReturnType<typeof createApplicationAction>>;

type UseCreateApplicationOptions = {
  onError?: () => void;
  onSuccess?: (result: CreateApplicationResult) => void | Promise<void>;
};

export function useJobApplications(jobId: string | undefined, query: JobApplicationsQuery = {}) {
  return useQuery({
    enabled: Boolean(jobId),
    queryFn: ({ signal }) => fetchJson<PaginatedApplications>(`/api/applications/job/${jobId}`, { query, signal }),
    queryKey: queryKeys.applications.byJob(jobId ?? "", query),
  });
}

export function useApplication(applicationId: string | undefined) {
  return useQuery({
    enabled: Boolean(applicationId),
    queryFn: ({ signal }) => fetchJson<JobApplication>(`/api/applications/${applicationId}`, { signal }),
    queryKey: queryKeys.applications.detail(applicationId ?? ""),
  });
}

export function useApplicationHistory(applicationId: string | undefined, page = 1, limit = 10) {
  return useQuery({
    enabled: Boolean(applicationId),
    queryFn: ({ signal }) => fetchJson<PaginatedApplicationHistory>(`/api/applications/${applicationId}/history`, { query: { page, limit }, signal }),
    queryKey: [...queryKeys.applications.history(applicationId ?? ""), { page, limit }],
  });
}

export function useMyApplications(query: JobApplicationsQuery = {}, enabled = true) {
  return useQuery({
    enabled,
    queryFn: ({ signal }) => fetchJson<PaginatedApplications>("/api/applications/me", { query, signal }),
    queryKey: queryKeys.applications.mine(query),
  });
}

export function useActiveJobApplicantCount() {
  return useQuery({
    queryFn: ({ signal }) => fetchJson<{ total: number }>("/api/applications/active-jobs/count", { signal }),
    queryKey: queryKeys.applications.activeJobCount(),
  });
}

export function useUpdateApplicationStatus(options: UseCreateApplicationOptions = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ApplicationStatusUpdateInput) => updateApplicationStatusAction(input),
    onError: options.onError,
    onSuccess: async (result) => {
      if (result.ok || result.status === 409 || result.status === 400 || result.code === "SCHOOL_INACTIVE") {
        await refreshMarketplace(queryClient);
        if (result.ok && result.data.status === "HIRED") await queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
      }
      await options.onSuccess?.(result);
    },
  });
}

export function useCreateApplication(options: UseCreateApplicationOptions = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ApplicationCreateInput) => createApplicationAction(input),
    onError: options.onError,
    onSuccess: async (result) => {
      if (!result.ok && result.code === "SESSION_EXPIRED") {
        startRouteLoading();
        void signOut({ redirect: false }).finally(() => {
          window.location.assign("/login");
        });
        return;
      }

      if (result.ok || result.code === "JOB_RESERVED" || result.code === "JOB_UNAVAILABLE") {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.applications.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.matching.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
        ]);
      }

      await options.onSuccess?.(result);
    },
  });
}
