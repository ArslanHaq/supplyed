import { AppRouteShell } from "@/components/route-shell";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("Find Jobs");

export default function FindJobsRoutePage() {
  return <AppRouteShell page="find-jobs" />;
}
