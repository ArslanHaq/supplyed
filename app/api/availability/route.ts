import { getAvailability } from "@/features/availability/queries";
import { routeError } from "@/lib/server/route-error";
export const dynamic = "force-dynamic";
export async function GET() { try { return Response.json(await getAvailability()); } catch (error) { return routeError(error); } }
