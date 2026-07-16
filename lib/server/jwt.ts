import "server-only";

type JwtPayload = {
  exp?: unknown;
};

export function readUnverifiedJwtExpiresAt(token: string | null | undefined): number | undefined {
  const payload = token?.split(".")[1];
  if (!payload) return undefined;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as JwtPayload;
    return typeof parsed.exp === "number" && Number.isFinite(parsed.exp) ? parsed.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}
