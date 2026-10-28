import { listInvitations } from "@/features/invitations/queries";
import { invitationStatuses, type InvitationStatus } from "@/features/invitations/types";
import { assertValidQuery } from "@/lib/server/query-validation";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    assertValidQuery(params, { status: { values: invitationStatuses } });
    return Response.json(await listInvitations({ page: Number(params.get("page") || 1), limit: Number(params.get("limit") || 20), status: (params.get("status") || undefined) as InvitationStatus | undefined }));
  } catch (error) { return routeError(error); }
}
