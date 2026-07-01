import { AppRouteShell } from "@/components/route-shell";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("Billing");

export default function BillingRoutePage() {
  return <AppRouteShell page="billing" />;
}
