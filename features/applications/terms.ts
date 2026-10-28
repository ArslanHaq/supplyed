import type { JobApplication } from "./types";

export function hasRecordedApplicationTerms(application: Pick<JobApplication, "termsStatus" | "agreedTerms">) {
  return application.termsStatus === "RECORDED" && Boolean(application.agreedTerms);
}
