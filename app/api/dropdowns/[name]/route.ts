import { api } from "@/lib/server/api-client";
import { routeError } from "@/lib/server/route-error";
import type { Dropdown } from "@/features/dropdowns/types";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(name) || name === "admin") return Response.json({ message: "Unknown dropdown." }, { status: 404 });
  try { return Response.json(await api.get<Dropdown>(`/dropdowns/${encodeURIComponent(name)}`, { auth: false, cache: "no-store" }), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return routeError(error); }
}
