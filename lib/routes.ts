import type { AppPage, RouteContext } from "@/types/supplyed";

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
  admin: "/admin",
};

export function buildAppHref(page: AppPage, ctx: RouteContext = {}) {
  const params = new URLSearchParams();

  if (ctx.jobId) params.set("jobId", ctx.jobId);
  if (ctx.teacherId) params.set("teacherId", ctx.teacherId);

  const query = params.toString();
  return `${appPathByPage[page]}${query ? `?${query}` : ""}`;
}
