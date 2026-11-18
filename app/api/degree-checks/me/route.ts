import { api } from "@/lib/server/api-client";
import { routeError } from "@/lib/server/route-error";
import type { MyDegreeCheck } from "@/features/degree-checks/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await api.get<MyDegreeCheck>("/degree-checks/me", { cache: "no-store" }));
  } catch (error) {
    return routeError(error);
  }
}
