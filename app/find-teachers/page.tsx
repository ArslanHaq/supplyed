import { AppRouteShell } from "@/components/route-shell";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("Find Teachers");

export default function FindTeachersRoutePage() {
  return <AppRouteShell page="find-teachers" />;
}
