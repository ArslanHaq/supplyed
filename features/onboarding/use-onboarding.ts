"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";

import type { OnboardingSnapshot } from "./types";

export function useOnboardingSnapshot() {
  return useQuery({
    queryFn: () => fetchJson<OnboardingSnapshot>("/api/onboarding/me"),
    queryKey: queryKeys.onboarding.current(),
  });
}
