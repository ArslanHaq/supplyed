import { normalizePayoutSummary } from "@/features/payments/schemas";
import type { PayoutSummary } from "@/features/payments/types";
import { api } from "@/lib/server/api-client";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (origin !== new URL(request.url).origin || (site && site !== "same-origin"))
    return Response.json({ message: "This request must come from this website." }, { status: 403 });
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    return Response.json({ message: "Send a JSON request." }, { status: 415 });
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body) || (body.amountPence !== undefined && (!Number.isSafeInteger(body.amountPence) || body.amountPence < 40))) return Response.json({ message: "Cash-outs start at £0.40. Enter a valid whole-pence amount." }, { status: 400 });
    if (typeof body.requestKey !== "string" || !/^[0-9a-f-]{36}$/i.test(body.requestKey)) return Response.json({ message: "A withdrawal request ID is required." }, { status: 400 });
    const amountPence = typeof body.amountPence === "number" ? body.amountPence : undefined;
    const payout = await api.post<PayoutSummary>("/payments/payout-account/instant-payout", { amountPence, requestKey: body.requestKey });

    return Response.json(normalizePayoutSummary(payout), { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
