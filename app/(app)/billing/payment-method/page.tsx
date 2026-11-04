import { AppRouteShell } from "@/components/route-shell";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("Payment method");

export default function BillingPaymentMethodRoutePage() {
  return <AppRouteShell page="billing" />;
}
