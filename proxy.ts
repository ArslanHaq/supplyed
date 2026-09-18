import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

import { getAuthenticatedEntryHref } from "./lib/routes";
import type { AppRole, ApplicationStatus } from "./types/supplyed";

const appRoles = new Set<AppRole>(["institution", "teacher", "individual"]);
const appStatuses = new Set<ApplicationStatus>([
  "none",
  "pending_review",
  "approved",
  "rejected",
  "suspended",
  "deactivated",
]);
const guestOnlyRoutes = new Set(["/forgot-password", "/login", "/signup"]);

function getAuthCookieSecret() {
  return (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    (process.env.NODE_ENV === "production" ? undefined : "supplyed-local-dev-auth-secret-change-before-production")
  );
}

function shouldUseSecureAuthCookies() {
  const authUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (authUrl) return authUrl.startsWith("https://");
  return process.env.NODE_ENV === "production";
}

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

function readAppRole(role: unknown): AppRole | null {
  return typeof role === "string" && appRoles.has(role as AppRole) ? (role as AppRole) : null;
}

function readApplicationStatus(status: unknown): ApplicationStatus {
  return typeof status === "string" && appStatuses.has(status as ApplicationStatus)
    ? (status as ApplicationStatus)
    : "none";
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/find-jobs" || pathname === "/job-detail") return NextResponse.next();
  const isGuestOnlyRoute = guestOnlyRoutes.has(pathname);
  const token = await getToken({
    req: request,
    secret: getAuthCookieSecret(),
    secureCookie: shouldUseSecureAuthCookies(),
  });

  const userId = typeof token?.userId === "string" ? token.userId : token?.sub;

  if (!userId) {
    if (isGuestOnlyRoute) return NextResponse.next();
    return redirectTo(request, "/login");
  }

  if (token?.appEmailVerified !== true) {
    return redirectTo(request, "/post-auth");
  }

  const role = readAppRole(token.role);
  const applicationStatus = readApplicationStatus(token.applicationStatus);
  const setupComplete = Boolean(role);
  const isOnboardingRoute = pathname.startsWith("/onboarding");

  if (isGuestOnlyRoute) {
    return redirectTo(request, getAuthenticatedEntryHref({ applicationStatus, role }));
  }

  if (!setupComplete && !isOnboardingRoute) {
    return redirectTo(request, "/onboarding");
  }

  // The onboarding server page checks live profile and document state. A JWT
  // can still say approved after an admin has marked the profile incomplete.

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/applications/:path*",
    "/billing/:path*",
    "/calendar/:path*",
    "/dashboard/:path*",
    "/find-jobs/:path*",
    "/find-teachers/:path*",
    "/forgot-password",
    "/job-detail/:path*",
    "/login",
    "/messaging/:path*",
    "/onboarding/:path*",
    "/post-job/:path*",
    "/settings/:path*",
    "/signup",
    "/teacher-profile/:path*",
  ],
};
