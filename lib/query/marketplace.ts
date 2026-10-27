import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./keys";

export async function refreshMarketplace(client: QueryClient) {
  await Promise.all([
    queryKeys.jobs.all, queryKeys.applications.all, queryKeys.invitations.all,
    queryKeys.bookings.all, queryKeys.notifications.all, queryKeys.matching.all,
    queryKeys.teachers.all, queryKeys.publicProfiles.all, queryKeys.conversations.all,
  ].map(queryKey => client.invalidateQueries({ queryKey })));
}
