import { AppRouteShell } from "@/components/route-shell";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("Calendar");

export default function CalendarRoutePage() {
  return <AppRouteShell page="calendar" />;
}
