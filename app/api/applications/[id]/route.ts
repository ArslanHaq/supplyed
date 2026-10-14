import { getApplicationById } from "@/features/applications/queries";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const application = await getApplicationById(id);

    if (!application) {
      return Response.json({ message: "Application not found." }, { status: 404 });
    }

    return Response.json(application);
  } catch (error) {
    return routeError(error);
  }
}
