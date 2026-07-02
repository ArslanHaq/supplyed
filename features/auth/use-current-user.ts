"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";

import type { AuthUser } from "./types";

export function useCurrentUser() {
  return useQuery({
    queryFn: () => fetchJson<AuthUser | null>("/api/auth/me"),
    queryKey: queryKeys.auth.me(),
  });
}
