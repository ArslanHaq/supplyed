import { api } from "@/lib/server/api-client";
import { routeError } from "@/lib/server/route-error";
import type { DegreeInstitutions } from "@/features/degree-checks/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await api.get<DegreeInstitutions>("/degree-checks/institutions"));
  } catch (error) {
    return routeError(error);
  }
}
