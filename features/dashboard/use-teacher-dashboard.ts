"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { PaginatedApplications } from "@/features/applications/types";
import type { PaginatedBookings } from "@/features/bookings/types";
import type { InvitationsPage } from "@/features/invitations/types";
import { usePayoutAccount, usePayoutBalance } from "@/features/payments/use-payments";
import { useSettingsProfile } from "@/features/settings/use-settings";
import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";

import {
  dashboardDayStart,
  getDashboardProfileTasks,
  getPendingDashboardInvitations,
  getUpcomingBookings,
  loadDashboardPages,
  summarizeDashboardApplications,
} from "./teacher-dashboard-data";

/** Composes authenticated teacher APIs; section failures remain independent. */
export function useTeacherDashboard() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const from = dashboardDayStart(now);
  const profileQuery = useSettingsProfile();
  const bookingsQuery = useQuery({
    queryKey: [...queryKeys.bookings.all, "teacher-dashboard", from],
    queryFn: async ({ signal }) => ({ bookings: await loadDashboardPages(async (pagination) => {
      const result = await fetchJson<PaginatedBookings>("/api/bookings/me", { query: { ...pagination, from, status: "CONFIRMED" }, signal });
      return { items: result.bookings, pagination: result.pagination };
    }) }),
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    staleTime: 30_000,
    retry: 1,
  });
  const applicationsQuery = useQuery({
    queryKey: [...queryKeys.applications.all, "teacher-dashboard"],
    queryFn: async ({ signal }) => {
      const applications = await loadDashboardPages(async (pagination) => {
        const result = await fetchJson<PaginatedApplications>("/api/applications/me", { query: pagination, signal });
        return { items: result.applications, pagination: result.pagination };
      });
      return { applications, summary: summarizeDashboardApplications(applications) };
    },
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    staleTime: 30_000,
    retry: 1,
  });
  const invitationsQuery = useQuery({
    queryKey: [...queryKeys.invitations.all, "teacher-dashboard"],
    queryFn: async ({ signal }) => ({ invitations: await loadDashboardPages(async (pagination) => {
      const result = await fetchJson<InvitationsPage>("/api/job-invitations/me", { query: { ...pagination, status: "PENDING" }, signal });
      return { items: result.invitations, pagination: result.pagination };
    }) }),
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: 1,
  });
  const payoutAccountQuery = usePayoutAccount();
  const balanceQuery = usePayoutBalance({ enabled: payoutAccountQuery.data?.ready === true });
  const queries = [profileQuery, bookingsQuery, applicationsQuery, invitationsQuery, payoutAccountQuery];
  const refresh = async () => {
    setNow(Date.now());
    await Promise.allSettled([...queries.map((query) => query.refetch()), ...(payoutAccountQuery.data?.ready ? [balanceQuery.refetch()] : [])]);
  };

  return {
    now,
    profileQuery,
    bookingsQuery,
    applicationsQuery,
    invitationsQuery,
    payoutAccountQuery,
    balanceQuery,
    upcomingBookings: getUpcomingBookings(bookingsQuery.data?.bookings ?? [], now),
    pendingInvitations: getPendingDashboardInvitations(invitationsQuery.data?.invitations ?? [], now),
    applicationSummary: applicationsQuery.data?.summary,
    profileTasks: profileQuery.data ? getDashboardProfileTasks(profileQuery.data) : undefined,
    refresh,
    isRefreshing: queries.some((query) => query.isFetching) || balanceQuery.isFetching,
  };
}
