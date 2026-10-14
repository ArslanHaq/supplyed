import { api } from "@/lib/server/api-client";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

/**
 * A 60-second ticket the browser uses to open the live messaging socket. The
 * real backend token stays on this server; the ticket cannot be used for
 * anything but the socket handshake.
 */
export async function POST() {
  try {
    return Response.json(await api.post<{ expiresInSeconds: number; ticket: string }>("/conversations/socket-ticket"));
  } catch (error) {
    return routeError(error);
  }
}
