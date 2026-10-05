import { PayoutCallbackPage } from "@/components/organisms/PayoutCallbackPage";
import { noIndexMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = noIndexMetadata("Resume payout setup");

/** Stripe asks for a fresh, single-use link when the previous onboarding link expires. */
export default function PayoutsRefreshPage() {
  return <PayoutCallbackPage kind="refresh" />;
}
