import { api } from "@/lib/server/api-client";
import { routeError } from "@/lib/server/route-error";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return Response.json(await api.get("/dropdowns", { auth: false, cache: "no-store" }), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return routeError(error); }
}
