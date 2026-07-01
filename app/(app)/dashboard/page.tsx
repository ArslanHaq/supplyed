import { AppRouteShell } from "@/components/route-shell";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("Dashboard");

export default function DashboardPage() {
  return <AppRouteShell page="dashboard" />;
}
