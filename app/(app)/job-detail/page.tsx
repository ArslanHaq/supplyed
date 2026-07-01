import { AppRouteShell } from "@/components/route-shell";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("Job Detail");

export default function JobDetailRoutePage() {
  return <AppRouteShell page="job-detail" />;
}
