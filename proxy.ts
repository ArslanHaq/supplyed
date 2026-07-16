import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

const appRoles = new Set(["institution", "teacher", "individual", "admin"]);

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

function readAppRole(role: unknown) {
  return typeof role === "string" && appRoles.has(role) ? role : null;
}

export async function proxy(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: getAuthCookieSecret(),
    secureCookie: shouldUseSecureAuthCookies(),
  });

  const userId = typeof token?.userId === "string" ? token.userId : token?.sub;

  if (!userId) {
    return redirectTo(request, "/login");
  }

  if (token?.appEmailVerified !== true) {
    return redirectTo(request, "/post-auth");
  }

  const role = readAppRole(token.role);
  const applicationStatus = typeof token.applicationStatus === "string" ? token.applicationStatus : "none";
  const setupComplete = role === "admin" || Boolean(role && applicationStatus !== "none");
  const isOnboardingRoute = request.nextUrl.pathname.startsWith("/onboarding");

  if (!setupComplete && !isOnboardingRoute) {
    return redirectTo(request, "/onboarding");
  }

  if (setupComplete && isOnboardingRoute) {
    return redirectTo(request, "/post-auth");
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/applications/:path*",
    "/billing/:path*",
    "/calendar/:path*",
    "/dashboard/:path*",
    "/find-jobs/:path*",
    "/find-teachers/:path*",
    "/job-detail/:path*",
    "/messaging/:path*",
    "/onboarding/:path*",
    "/post-job/:path*",
    "/teacher-profile/:path*",
  ],
};
