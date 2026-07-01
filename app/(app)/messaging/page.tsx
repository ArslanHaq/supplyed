import { AppRouteShell } from "@/components/route-shell";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("Messages");

export default function MessagingRoutePage() {
  return <AppRouteShell page="messaging" />;
}
