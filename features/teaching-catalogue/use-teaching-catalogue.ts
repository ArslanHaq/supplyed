"use client";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/query/fetch-json";
import type { TeachingCatalogue, TeachingCatalogueOptions } from "./types";

// Compatibility export: invalidating this prefix refreshes every source collection.
export const teachingCatalogueKey = ["teaching-catalogue"] as const;

export function useTeachingCatalogue(options: TeachingCatalogueOptions = {}) {
  const scope = options.scope ?? "all";
  const awaitingSchoolType = scope === "schoolType" && !options.schoolType;
  const path = scope === "school" ? "/api/teaching-catalogue/school" : "/api/teaching-catalogue";

  return useQuery({
    enabled: (options.enabled ?? true) && !awaitingSchoolType,
    queryFn: () => fetchJson<TeachingCatalogue>(path, {
      query: scope === "schoolType" ? { schoolType: options.schoolType } : undefined,
    }),
    queryKey: [...teachingCatalogueKey, scope, options.schoolType ?? null],
    staleTime: 30_000,
    gcTime: 300_000,
    refetchOnWindowFocus: "always",
    retry: 1,
  });
}
