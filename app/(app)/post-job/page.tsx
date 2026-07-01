import { AppRouteShell } from "@/components/route-shell";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("Post a Job");

export default function PostJobRoutePage() {
  return <AppRouteShell page="post-job" />;
}
