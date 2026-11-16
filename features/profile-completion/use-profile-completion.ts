"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";
import type { ProfileCompletion } from "./types";

export function useProfileCompletion() {
  return useQuery({
    queryKey: queryKeys.profileCompletion.mine(),
    queryFn: () => fetchJson<ProfileCompletion>("/api/profile-completion"),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}
