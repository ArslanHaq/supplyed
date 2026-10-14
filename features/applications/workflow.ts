import type { JobApplicationStatus } from "./types";

export const applicationPipeline: readonly Exclude<JobApplicationStatus, "REJECTED">[] = [
  "APPLIED", "VIEWED", "SHORTLISTED", "INTERVIEW", "HIRED",
];

/** Applications may skip ahead, but never return to a previous or terminal stage. */
export function canTransitionApplication(current: JobApplicationStatus, target: JobApplicationStatus) {
  if (current === "HIRED" || current === "REJECTED") return false;
  const currentIndex = applicationPipeline.indexOf(current);
  if (currentIndex < 0) return false;
  if (target === "REJECTED") return true;
  return applicationPipeline.indexOf(target) > currentIndex;
}
