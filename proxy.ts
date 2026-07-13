import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

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
