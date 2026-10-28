import { AppRouteShell } from "@/components/route-shell";
import { noIndexMetadata } from "@/lib/seo";
export const metadata = noIndexMetadata("Job invitations");
export default function InvitationsRoute() { return <AppRouteShell page="job-invitations" />; }
