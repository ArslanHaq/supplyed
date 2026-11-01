import type { Job } from "./types";

/** Only a newly published instant role pauses navigation for proactive invitations. */
export function shouldShowInstantMatches(job: Pick<Job, "jobType" | "status">, editingExistingJob: boolean) {
  return !editingExistingJob && job.status === "ACTIVE" && job.jobType === "INSTANT";
}
