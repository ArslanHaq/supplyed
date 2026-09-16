"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { signOut } from "next-auth/react";

import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";
import { startRouteLoading } from "@/lib/navigation-loading";

import { createApplicationAction, updateApplicationStatusAction } from "./actions";
import type { ApplicationCreateInput, ApplicationStatusUpdateInput, JobApplicationsQuery, PaginatedApplications } from "./types";

type CreateApplicationResult = Awaited<ReturnType<typeof createApplicationAction>>;

type UseCreateApplicationOptions = {
  onError?: () => void;
  onSuccess?: (result: CreateApplicationResult) => void | Promise<void>;
};

export function useJobApplications(jobId: string | undefined, query: JobApplicationsQuery = {}) {
  return useQuery({
    enabled: Boolean(jobId),
    queryFn: () => fetchJson<PaginatedApplications>(`/api/applications/job/${jobId}`, { query }),
    queryKey: queryKeys.applications.byJob(jobId ?? "", query),
  });
}

export function useUpdateApplicationStatus(options: UseCreateApplicationOptions = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ApplicationStatusUpdateInput) => updateApplicationStatusAction(input),
    onError: options.onError,
    onSuccess: async (result) => {
      if (result.ok) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.applications.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.matching.all }),
        ]);
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

      if (result.ok) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.applications.all });
      }

      await options.onSuccess?.(result);
    },
  });
}
