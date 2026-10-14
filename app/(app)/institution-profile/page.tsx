import { AppRouteShell } from "@/components/route-shell";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("School Profile");

export default function InstitutionProfileRoutePage() {
  return <AppRouteShell page="institution-profile" />;
}
