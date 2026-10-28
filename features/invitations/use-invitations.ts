"use client";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";
import { effectiveInvitationStatus } from "./schemas";
import type { Invitation, InvitationListQuery, InvitationsPage } from "./types";

export function useInvitations(query: InvitationListQuery, enabled = true) {
  return useQuery({ enabled, queryKey: queryKeys.invitations.list(query), queryFn: () => fetchJson<InvitationsPage>("/api/job-invitations/me", { query }), refetchOnMount: "always", refetchOnWindowFocus: "always", refetchInterval: current => current.state.data?.invitations.some(item => item.status === "PENDING") || query.status === "PENDING" ? 30000 : false, refetchIntervalInBackground: false });
}

/** All invitations for job-level summaries. The API is paginated, so one page is never treated as the full filter set. */
export function useAllInvitations(enabled = true) {
  return useQuery({
    enabled,
    queryKey: [...queryKeys.invitations.all, "all-pages"],
    queryFn: async () => {
      const invitations: Invitation[] = [];
      const seen = new Set<string>();
      let page = 1;
      while (true) {
        const result = await fetchJson<InvitationsPage>("/api/job-invitations/me", { query: { limit: 100, page } });
        for (const invitation of result.invitations) {
          if (!seen.has(invitation.id)) { seen.add(invitation.id); invitations.push(invitation); }
        }
        if (!result.pagination.hasNextPage) return invitations;
        if (page >= result.pagination.totalPages || page >= 1000) throw new Error("Invitation pages could not be completed.");
        page += 1;
      }
    },
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: current => current.state.data?.some(item => item.status === "PENDING") ? 30000 : false,
    refetchIntervalInBackground: false,
  });
}
export function useInvitation(id?: string, enabled = true) {
  return useQuery({ enabled: enabled && Boolean(id), queryKey: queryKeys.invitations.detail(id ?? ""), queryFn: () => fetchJson<Invitation>(`/api/job-invitations/${id}`), refetchOnMount: "always", refetchOnWindowFocus: "always", refetchInterval: query => query.state.data?.status === "PENDING" ? 15000 : false, refetchIntervalInBackground: false, retry: false });
}
/** Update controls at the deadline even before the backend expiry worker runs. */
export function useInvitationClock(invitation?: Invitation) {
  const [now, setNow] = useState(() => Date.now());
  const client = useQueryClient();
  const deadline = invitation?.status === "PENDING" ? invitation.expiresAt : undefined;
  useEffect(() => {
    if (!deadline) return;
    const remaining = Date.parse(deadline) - Date.now();
    if (!Number.isFinite(remaining) || (remaining <= 0 && now >= Date.parse(deadline))) return;
    const timer = setTimeout(() => {
      setNow(Date.now());
      void client.invalidateQueries({ queryKey: queryKeys.invitations.all });
    }, Math.min(Math.max(remaining, 0), 2147483647));
    return () => clearTimeout(timer);
  }, [deadline, client, now]);
  return invitation ? effectiveInvitationStatus(invitation, now) : undefined;
}
