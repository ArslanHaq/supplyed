import { api } from "@/lib/server/api-client";
import { routeError } from "@/lib/server/route-error";

type RouteContext = { params: Promise<{ token: string }> };

export const dynamic = "force-dynamic";

function validToken(token: string) {
  return token.trim().length >= 16 && token.length <= 512;
}

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  if (!validToken(token)) return Response.json({ message: "This approval link is not valid." }, { status: 404 });

  try {
    return Response.json(await api.get(`/signatory-approvals/token/${encodeURIComponent(token)}`, { auth: false, cache: "no-store" }));
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;
  if (!validToken(token)) return Response.json({ message: "This approval link is not valid." }, { status: 404 });

  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  let originHost: string | undefined;
  try { originHost = origin ? new URL(origin).host : undefined; } catch { /* Invalid origins fail the same check. */ }
  if (!originHost || originHost !== host) {
    return Response.json({ message: "Open the approval link directly before responding." }, { status: 403 });
  }

  try {
    const input = await request.json().catch(() => null) as { action?: unknown; acceptTerms?: unknown; reason?: unknown } | null;
    if (!input || typeof input !== "object" || Array.isArray(input)) return Response.json({ message: "Enter a valid approval response." }, { status: 400 });
    if (input.action === "approve") {
      if (input.acceptTerms !== true) return Response.json({ message: "Accept the terms before approving.", fieldErrors: { acceptTerms: "Accept the terms before approving." } }, { status: 400 });
      return Response.json(await api.post(
        `/signatory-approvals/token/${encodeURIComponent(token)}/approve`,
        { acceptTerms: input.acceptTerms === true },
        { auth: false },
      ));
    }
    if (input.action === "decline") {
      if (typeof input.reason !== "string" || !input.reason.trim() || input.reason.trim().length > 1000) return Response.json({ message: "Enter a reason of up to 1,000 characters.", fieldErrors: { reason: "Enter a reason of up to 1,000 characters." } }, { status: 400 });
      return Response.json(await api.post(
        `/signatory-approvals/token/${encodeURIComponent(token)}/decline`,
        { reason: typeof input.reason === "string" ? input.reason.trim() : "" },
        { auth: false },
      ));
    }
    return Response.json({ message: "Choose approve or decline." }, { status: 400 });
  } catch (error) {
    return routeError(error);
  }
}
