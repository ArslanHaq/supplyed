import { getInvoice } from "@/features/payments/queries";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return Response.json(await getInvoice(id));
  } catch (error) {
    return routeError(error);
  }
}
