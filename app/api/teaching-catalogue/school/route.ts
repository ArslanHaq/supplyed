import { api } from "@/lib/server/api-client";
import { routeError } from "@/lib/server/route-error";
import type { TeachingCatalogue } from "@/features/teaching-catalogue/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await api.get<TeachingCatalogue>("/teaching-catalogue/school", { cache: "no-store" }), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return routeError(error);
  }
}
