import { AppRouteShell } from "@/components/route-shell";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata("Teacher Profile");

export default function TeacherProfileRoutePage() {
  return <AppRouteShell page="teacher-profile" />;
}
