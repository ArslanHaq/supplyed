import type { JobApplicationStatus } from "./types";

export const applicationTransitions: Record<JobApplicationStatus, JobApplicationStatus[]> = {
  APPLIED: ["VIEWED", "SHORTLISTED", "REJECTED"],
  VIEWED: ["SHORTLISTED", "REJECTED"],
  SHORTLISTED: ["INTERVIEW", "REJECTED"],
  INTERVIEW: ["HIRED", "REJECTED"],
  HIRED: ["COMPLETED"],
  COMPLETED: [],
  REJECTED: [],
};
export const applicationStatuses = Object.keys(applicationTransitions) as JobApplicationStatus[];
export function statusLabel(status: string) {
  return status.toLowerCase().replace(/_/g, " ");
}
