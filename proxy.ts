import { NextResponse, type NextRequest } from "next/server";

// This branch exposes only the public waitlist site, regardless of auth cookies.
const publicPages = new Set(["/", "/founding-schools", "/founding-teachers", "/how-it-works"]);
const publicAssets = new Set(["/favicon.ico", "/favicon.svg", "/manifest.webmanifest", "/robots.txt", "/sitemap.xml", "/api/health"]);

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname.replace(/\/+$/, "") || "/";
  if (publicPages.has(pathname) || publicAssets.has(pathname)) return NextResponse.next();

  // Do not expose product APIs, OAuth callbacks or writes on unavailable pages.
  if (pathname.startsWith("/api/") || !["GET", "HEAD"].includes(request.method)) {
    return NextResponse.json({ message: "This endpoint is not available on the waitlist site." }, { status: 404 });
  }

  const destination = request.nextUrl.clone();
  destination.pathname = "/";
  destination.search = "";
  return NextResponse.redirect(destination);
}

export const config = {
  matcher: ["/((?!_next/).*)"],
};
