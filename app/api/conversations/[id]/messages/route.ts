import { listMessages } from "@/features/conversations/queries";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const before = new URL(request.url).searchParams.get("before") || undefined;

    return Response.json(await listMessages(id, before));
  } catch (error) {
    return routeError(error);
  }
}
