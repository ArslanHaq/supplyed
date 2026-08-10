import { AppRouteShell } from "@/components/route-shell";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("Security");

export default function SecurityRoutePage() {
  return <AppRouteShell page="security" />;
}
