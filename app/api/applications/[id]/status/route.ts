import { updateApplicationStatus } from "@/features/applications/queries";
import type { JobApplicationStatus } from "@/features/applications/types";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

const statuses: JobApplicationStatus[] = ["APPLIED", "COMPLETED", "HIRED", "INTERVIEW", "REJECTED", "SHORTLISTED", "VIEWED"];

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const payload = (await request.json()) as { status?: string };
    const status = statuses.find((item) => item === payload.status);

    if (!status) {
      return Response.json({ message: "Choose a valid application status." }, { status: 400 });
    }

    return Response.json(await updateApplicationStatus({ id, status }));
  } catch (error) {
    return routeError(error);
  }
}
