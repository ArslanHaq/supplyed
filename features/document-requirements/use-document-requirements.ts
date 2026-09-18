"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";

import type { ApplicationDocumentRequirement } from "./types";

export function useApplicationDocumentRequirements(enabled = true) {
  return useQuery({
    enabled,
    queryFn: () => fetchJson<ApplicationDocumentRequirement[]>("/api/document-requirements/application"),
    queryKey: queryKeys.documentRequirements.application(),
  });
}
