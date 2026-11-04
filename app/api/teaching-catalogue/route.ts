import { api } from "@/lib/server/api-client";
import { routeError } from "@/lib/server/route-error";
import type { TeachingCatalogue } from "@/features/teaching-catalogue/types";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const schoolType = new URL(request.url).searchParams.get("schoolType");
  if (schoolType && schoolType !== "PRIMARY" && schoolType !== "SECONDARY") {
    return Response.json({ code: "INVALID_SCHOOL_TYPE", message: "Choose Primary or Secondary." }, { status: 400 });
  }
  try { return Response.json(await api.get<TeachingCatalogue>("/teaching-catalogue", { auth: false, cache: "no-store", query: { schoolType } }), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return routeError(error); }
}
