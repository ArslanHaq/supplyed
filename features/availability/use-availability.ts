"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/lib/query/fetch-json";
import { updateAvailabilityAction } from "./actions";
import type { AvailabilitySnapshot, JobAvailabilityCheck, TeacherAvailability } from "./types";

const availabilityKey = ["availability"] as const;

export function useAvailability() {
  return useQuery({ queryKey: availabilityKey, queryFn: () => fetchJson<AvailabilitySnapshot>("/api/availability") });
}

export function useJobAvailability(jobId: string, enabled = true) {
  return useQuery({
    enabled: enabled && Boolean(jobId),
    queryKey: [...availabilityKey, "job", jobId],
    queryFn: () => fetchJson<JobAvailabilityCheck>(`/api/availability/jobs/${jobId}`),
  });
}

export function useUpdateAvailability() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: TeacherAvailability) => updateAvailabilityAction(input),
    onSuccess: async (result) => { if (result.ok) await client.invalidateQueries({ queryKey: availabilityKey }); },
  });
}
