import "server-only";

type JwtPayload = {
  exp?: unknown;
  [key: string]: unknown;
};

export function readUnverifiedJwtPayload(token: string | null | undefined): JwtPayload | undefined {
  const payload = token?.split(".")[1];
  if (!payload) return undefined;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as JwtPayload) : undefined;
  } catch {
    return undefined;
  }
}

export function readUnverifiedJwtExpiresAt(token: string | null | undefined): number | undefined {
  const payload = readUnverifiedJwtPayload(token);
  return typeof payload?.exp === "number" && Number.isFinite(payload.exp) ? payload.exp * 1000 : undefined;
}
