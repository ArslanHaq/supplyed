import { countApplicationsForActiveJobs } from "@/features/applications/queries";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await countApplicationsForActiveJobs());
  } catch (error) {
    return routeError(error);
  }
}
