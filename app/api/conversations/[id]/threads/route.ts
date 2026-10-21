import { listConversationThreads } from "@/features/conversations/queries";
import { assertValidQuery } from "@/lib/server/query-validation";
import { routeError } from "@/lib/server/route-error";
import type { ConversationTopic } from "@/features/conversations/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    assertValidQuery(searchParams, { topic: { values: ["GENERAL", "JOBS"] }, before: { uuid: true } });
    const topic = (searchParams.get("topic") || "JOBS") as ConversationTopic;
    return Response.json(await listConversationThreads(id, topic, searchParams.get("before") || undefined, Number(searchParams.get("limit")) || 20));
  } catch (error) {
    return routeError(error);
  }
}
