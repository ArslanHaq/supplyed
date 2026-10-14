import { backendEnabled } from "@/lib/server/backend-config";

export const dynamic = "force-dynamic";

/** Liveness plus configuration readiness; does not expose secrets or call providers. */
export function GET() {
  try {
    if (!backendEnabled() || !(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET)?.trim()) {
      return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
