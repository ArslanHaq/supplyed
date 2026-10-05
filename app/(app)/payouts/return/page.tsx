import { PayoutCallbackPage } from "@/components/organisms/PayoutCallbackPage";
import { noIndexMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = noIndexMetadata("Payout setup");

/** A fresh payout-account query runs after Stripe returns to this page. */
export default function PayoutsReturnPage() {
  return <PayoutCallbackPage kind="return" />;
}
