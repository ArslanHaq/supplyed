import "server-only";

import { ApiError } from "@/lib/server/api-client";
import { getServerAuthContext } from "@/lib/server/auth-context";

export async function requirePayoutInstructor() {
  const context = await getServerAuthContext();
  if (!context?.userId) throw new ApiError("Sign in to manage your payouts.", 401);
  if (context.role !== "teacher") throw new ApiError("Payout settings are available to instructors only.", 403);
}
