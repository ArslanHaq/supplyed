import { redirect } from "next/navigation";

import { createPayoutOnboardingLinkAction } from "@/features/payments/actions";

export const dynamic = "force-dynamic";

/**
 * Stripe sends the teacher here when their setup link has expired or was
 * already used. A fresh link is made and they carry on where they left off.
 */
export async function GET() {
  const result = await createPayoutOnboardingLinkAction();

  redirect(result.ok && result.data.url ? result.data.url : "/billing?payouts=error");
}
