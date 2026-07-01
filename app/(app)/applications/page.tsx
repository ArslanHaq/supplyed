import { AppRouteShell } from "@/components/route-shell";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("Applications");

export default function ApplicationsRoutePage() {
  return <AppRouteShell page="applications" />;
}
