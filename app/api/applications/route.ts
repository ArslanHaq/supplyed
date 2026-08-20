import { createApplication } from "@/features/applications/queries";
import type { CreateApplicationInput } from "@/features/applications/types";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Partial<CreateApplicationInput>;
    const coverLetter = payload.coverLetter ?? "";
    const jobId = payload.jobId ?? "";

    if (!jobId.trim()) {
      return Response.json({ message: "Choose a valid job before applying." }, { status: 400 });
    }

    if (coverLetter.length > 2000) {
      return Response.json({ message: "Cover letter must be 2,000 characters or less." }, { status: 400 });
    }

    return Response.json(
      await createApplication({
        coverLetter,
        jobId,
      }),
    );
  } catch (error) {
    return routeError(error);
  }
}
