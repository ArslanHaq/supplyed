"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { unwrapActionResult } from "@/lib/server/action-response";
import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";

import { startIdentityVerificationAction } from "./actions";
import { normalizeMyIdentityVerification } from "./schemas";
import type { IdentityState, MyIdentityVerification } from "./types";

/** While TrustID is working the result can land any minute; the notification socket also refreshes it. */
const IN_PROGRESS: IdentityState[] = ["LINK_SENT", "PROCESSING"];

export function useMyIdentityVerification(options: { enabled?: boolean; initialData?: MyIdentityVerification | null } = {}) {
  return useQuery({
    enabled: options.enabled ?? true,
    initialData: options.initialData ?? undefined,
    queryFn: async () => normalizeMyIdentityVerification(await fetchJson<unknown>("/api/identity-verification/me")),
    queryKey: queryKeys.identityVerification.mine(),
    refetchInterval: (query) => (query.state.data && IN_PROGRESS.includes(query.state.data.state) ? 30_000 : false),
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
}

/** Starts the check; the teacher must have agreed to it. */
export function useStartIdentityVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => unwrapActionResult(await startIdentityVerificationAction({ consent: true })),
    onSuccess: (verification) => {
      queryClient.setQueryData<MyIdentityVerification>(queryKeys.identityVerification.mine(), (current) => ({
        required: current?.required ?? true,
        verifiedAt: current?.verifiedAt ?? null,
        canStart: false,
        state: current?.state === "VERIFIED" ? "VERIFIED" : "LINK_SENT",
        verification,
      }));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.identityVerification.all });
    },
  });
}
