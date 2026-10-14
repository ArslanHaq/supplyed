import { AppRouteShell } from "@/components/route-shell";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("Bookings");

export default function BookingsRoutePage() {
  return <AppRouteShell page="bookings" />;
}
