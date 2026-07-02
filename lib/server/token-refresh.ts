import "server-only";

import type { ServerAuthContext } from "./auth-context";

export async function getValidAccessToken(authContext: ServerAuthContext): Promise<string | null> {
  // TODO: Refresh/rotate tokens here once Auth.js and the backend token contract are connected.
  return authContext?.accessToken ?? null;
}
