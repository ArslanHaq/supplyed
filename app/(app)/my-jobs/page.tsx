import { AppRouteShell } from "@/components/route-shell";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("My Jobs");

export default function MyJobsRoutePage() {
  return <AppRouteShell page="my-jobs" />;
}
