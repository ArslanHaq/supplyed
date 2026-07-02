import "server-only";

export type ServerAuthContext = {
  accessToken?: string | null;
  email?: string | null;
  refreshToken?: string | null;
  role?: string | null;
  userId: string;
} | null;

export async function getServerAuthContext(): Promise<ServerAuthContext> {
  // TODO: Replace this with Auth.js `auth()` once backend/auth integration starts.
  return null;
}
