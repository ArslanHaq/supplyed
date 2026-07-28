import type { AppPage, AppRole, ApplicationStatus, RouteContext } from "@/types/supplyed";

export const appPathByPage: Record<AppPage, string> = {
  dashboard: "/dashboard",
  "post-job": "/post-job",
  applications: "/applications",
  "find-teachers": "/find-teachers",
  "find-jobs": "/find-jobs",
  "job-detail": "/job-detail",
  "teacher-profile": "/teacher-profile",
  messaging: "/messaging",
  calendar: "/calendar",
  billing: "/billing",
};

export function buildAppHref(page: AppPage, ctx: RouteContext = {}) {
  const params = new URLSearchParams();

  if (ctx.jobId) params.set("jobId", ctx.jobId);
  if (ctx.teacherId) params.set("teacherId", ctx.teacherId);

  const query = params.toString();
  return `${appPathByPage[page]}${query ? `?${query}` : ""}`;
}

export function hasSubmittedApplicationStatus(status: ApplicationStatus) {
  return status !== "none";
}

export function isApprovedApplicationStatus(status: ApplicationStatus) {
  return status === "approved";
}

export function shouldShowApplicationStatusPage(role: AppRole | null | undefined, status: ApplicationStatus) {
  return role !== "individual" && (status === "pending_review" || status === "rejected" || status === "suspended");
}

export function getAuthenticatedEntryHref({
  applicationStatus,
  role,
}: {
  applicationStatus: ApplicationStatus;
  role: AppRole | null | undefined;
}) {
  if (!role || !hasSubmittedApplicationStatus(applicationStatus)) return "/onboarding";
  return buildAppHref("dashboard");
}
