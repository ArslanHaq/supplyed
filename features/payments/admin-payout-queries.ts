import "server-only";

import { api, ApiError } from "@/lib/server/api-client";
import { getServerAuthContext } from "@/lib/server/auth-context";

import { normalizePayoutAccount } from "./schemas";
import type { PayoutAccount } from "./types";

/** Administrators can inspect an instructor's setup; schools have no access to this endpoint. */
export async function getInstructorPayoutAccount(instructorId: string): Promise<PayoutAccount> {
  const context = await getServerAuthContext();
  if (!context?.userId) throw new ApiError("Sign in to view payout accounts.", 401);
  if (context.role !== "admin") throw new ApiError("Only administrators can view another instructor's payout setup.", 403);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(instructorId)) {
    throw new ApiError("Enter a valid instructor profile ID.", 400);
  }
  if (!process.env.API_BASE_URL) throw new ApiError("Payout accounts are unavailable. Please try again later.", 503);

  return normalizePayoutAccount(await api.get<PayoutAccount>(`/payments/payout-accounts/instructor/${encodeURIComponent(instructorId)}`, { cache: "no-store" }));
}
