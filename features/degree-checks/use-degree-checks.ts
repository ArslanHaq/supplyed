"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { unwrapActionResult } from "@/lib/server/action-response";
import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";

import { startConsentUploadAction, submitDegreeCheckAction } from "./actions";
import type { DegreeCheckInput, DegreeInstitutions, MyDegreeCheck } from "./types";

export function useMyDegreeCheck() {
  return useQuery({
    queryFn: () => fetchJson<MyDegreeCheck>("/api/degree-checks/me"),
    queryKey: queryKeys.degreeChecks.mine(),
    refetchOnWindowFocus: true,
  });
}

/** Hedd's list of universities: only needed while the teacher can start a check. */
export function useDegreeInstitutions(enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: () => fetchJson<DegreeInstitutions>("/api/degree-checks/institutions"),
    queryKey: queryKeys.degreeChecks.institutions(),
    staleTime: 60 * 60 * 1000,
  });
}

/** Uploads the signed consent form, then sends the degree to Hedd. The form is uploaded again on every try. */
export function useSubmitDegreeCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, input }: { file: File; input: Omit<DegreeCheckInput, "consentFileKey"> }) => {
      const upload = unwrapActionResult(await startConsentUploadAction(file.type, file.size));
      // The URL is signed over these headers, so send them exactly as returned.
      const response = await fetch(upload.url, { body: file, headers: upload.requiredHeaders, method: "PUT" });
      if (!response.ok) throw new Error("The consent form upload failed. Try again.");

      return unwrapActionResult(await submitDegreeCheckAction({ ...input, consentFileKey: upload.fileKey }));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.degreeChecks.mine() });
    },
  });
}
