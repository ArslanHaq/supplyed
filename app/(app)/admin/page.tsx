import { AppRouteShell } from "@/components/route-shell";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("Admin");

export default function AdminRoutePage() {
  return <AppRouteShell page="admin" />;
}
