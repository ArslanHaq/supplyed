import { api } from "@/lib/server/api-client";
import { routeError } from "@/lib/server/route-error";
export async function GET(request: Request) {
  try { return Response.json(await api.get("/instructors/me/availability", { query: { month: new URL(request.url).searchParams.get("month") } })); }
  catch (error) { return routeError(error); }
}
export async function PATCH(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("content-type")?.split(";")[0] !== "application/json")
    return Response.json({ message: "Use a same-origin JSON request." }, { status: 403 });
  try { return Response.json(await api.patch("/instructors/me/availability", await request.json())); }
  catch (error) { return routeError(error); }
}
