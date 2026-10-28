import { AppRouteShell } from "@/components/route-shell";
import { noIndexMetadata } from "@/lib/seo";
export const metadata = noIndexMetadata("Job invitation");
export default async function InvitationRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppRouteShell page="job-invitations" initialContext={{ invitationId: id }} />;
}
