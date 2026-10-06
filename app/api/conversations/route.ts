import { listMyConversations } from "@/features/conversations/queries";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page"));
    const limit = Number(searchParams.get("limit"));

    return Response.json(
      await listMyConversations(
        Number.isInteger(page) && page >= 1 ? page : 1,
        Number.isInteger(limit) && limit >= 1 && limit <= 100 ? limit : 20,
      ),
    );
  } catch (error) {
    return routeError(error);
  }
}
