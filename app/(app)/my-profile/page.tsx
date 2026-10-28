import { AppRouteShell } from "@/components/route-shell";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("My Profile");

export default function MyProfileRoutePage() {
  return <AppRouteShell page="my-profile" />;
}
