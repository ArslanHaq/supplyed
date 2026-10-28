import { normalizePayoutSummary } from "@/features/payments/schemas";
import type { PayoutSummary } from "@/features/payments/types";
import { api } from "@/lib/server/api-client";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body) || (body.amountPence !== undefined && (!Number.isSafeInteger(body.amountPence) || body.amountPence < 40))) return Response.json({ message: "Cash-outs start at £0.40. Enter a valid whole-pence amount." }, { status: 400 });
    const amountPence = typeof body.amountPence === "number" ? body.amountPence : undefined;
    const payout = await api.post<PayoutSummary>("/payments/payout-account/instant-payout", { amountPence });

    return Response.json(normalizePayoutSummary(payout), { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
