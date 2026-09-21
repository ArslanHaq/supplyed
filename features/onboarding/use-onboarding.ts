"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";
import type { AppRole } from "@/types/supplyed";

import type { OnboardingDocumentRequirement, OnboardingSnapshot } from "./types";

export function useOnboardingSnapshot(accountEmail: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    enabled: options.enabled ?? Boolean(accountEmail),
    queryFn: () => fetchJson<OnboardingSnapshot>("/api/onboarding/me"),
    queryKey: [...queryKeys.onboarding.current(), accountEmail],
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    staleTime: 0,
  });
}

/**
 * The documents a profile has to upload. Seeded from the server snapshot when
 * available and refreshed from the backend as soon as the hook is enabled.
 */
export function useOnboardingDocumentRequirements(
  role: AppRole | null,
  options: { enabled?: boolean; initialData?: OnboardingDocumentRequirement[] } = {},
) {
  return useQuery({
    enabled: options.enabled ?? Boolean(role),
    initialData: options.initialData && options.initialData.length > 0 ? options.initialData : undefined,
    queryFn: () => fetchJson<OnboardingDocumentRequirement[]>("/api/onboarding/document-requirements", { query: { role } }),
    queryKey: queryKeys.onboarding.documentRequirements(role ?? "none"),
    staleTime: 0,
  });
}
