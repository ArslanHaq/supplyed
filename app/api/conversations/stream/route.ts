import { getServerAuthContext } from "@/lib/server/auth-context";
import { getValidAccessToken } from "@/lib/server/token-refresh";

export const dynamic = "force-dynamic";

/**
 * Relays the backend's live conversation events (Server-Sent Events) to the
 * browser. The backend token stays on this server: the browser connects here
 * with its session cookie, and this route connects to the API with the token.
 * When the browser goes away, the upstream connection is closed with it.
 */
export async function GET(request: Request) {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) return new Response("Messaging is not available.", { status: 503 });

  const accessToken = await getValidAccessToken(await getServerAuthContext());
  if (!accessToken) return new Response("Sign in again to continue.", { status: 401 });

  const upstream = await fetch(`${baseUrl.replace(/\/+$/, "")}/conversations/events`, {
    cache: "no-store",
    headers: { Accept: "text/event-stream", Authorization: `Bearer ${accessToken}` },
    signal: request.signal,
  }).catch(() => null);

  if (!upstream?.ok || !upstream.body) {
    return new Response("Live updates are unavailable.", { status: upstream?.status === 401 ? 401 : 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
      // Stops proxies such as nginx from buffering the stream.
      "X-Accel-Buffering": "no",
    },
  });
}
