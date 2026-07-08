import "server-only";

export type ServerAuthContext = {
  accessToken?: string | null;
  email?: string | null;
  refreshToken?: string | null;
  role?: string | null;
  userId: string;
} | null;

export async function getServerAuthContext(): Promise<ServerAuthContext> {
  const { auth } = await import("@/auth");
  const session = await auth();

  if (!session?.user?.id) return null;

  return {
    accessToken: null,
    email: session.user.email,
    refreshToken: null,
    role: session.user.role,
    userId: session.user.id,
  };
}
