import { listApplicationDocumentRequirements } from "@/features/document-requirements/queries";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await listApplicationDocumentRequirements());
  } catch (error) {
    return routeError(error);
  }
}
