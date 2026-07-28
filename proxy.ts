import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

const appRoles = new Set(["institution", "teacher", "individual"]);
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

function readAppRole(role: unknown) {
  return typeof role === "string" && appRoles.has(role) ? role : null;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
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
  const applicationStatus = typeof token.applicationStatus === "string" ? token.applicationStatus : "none";
  const setupComplete = Boolean(role && applicationStatus !== "none");
  const isOnboardingRoute = pathname.startsWith("/onboarding");

  if (isGuestOnlyRoute) {
    return redirectTo(request, setupComplete ? "/dashboard" : "/onboarding");
  }

  if (!setupComplete && !isOnboardingRoute) {
    return redirectTo(request, "/onboarding");
  }

  if (setupComplete && isOnboardingRoute) {
    return redirectTo(request, "/dashboard");
  }

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
    "/signup",
    "/teacher-profile/:path*",
  ],
};
