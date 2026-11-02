import "server-only";
import { api } from "@/lib/server/api-client";
import type { AvailabilitySnapshot, JobAvailabilityCheck } from "./types";

export function getAvailability(): Promise<AvailabilitySnapshot> {
  return api.get("/availability/me", { cache: "no-store" });
}

export function checkJobAvailability(jobId: string): Promise<JobAvailabilityCheck> {
  return api.get(`/availability/jobs/${encodeURIComponent(jobId)}/check`, { cache: "no-store" });
}
