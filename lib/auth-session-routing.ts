export type AuthSessionTicketPayload = {
  nextHref: string;
  ticket: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function readInternalHref(value: unknown, fallback = "/post-auth") {
  const href = readString(value);

  if (!href || !href.startsWith("/") || href.startsWith("//")) return fallback;

  return href;
}

export function readAuthSessionTicketPayload(value: unknown): AuthSessionTicketPayload | null {
  if (!isRecord(value)) return null;

  const ticket = readString(value.ticket);
  if (!ticket) return null;

  return {
    nextHref: readInternalHref(value.nextHref),
    ticket,
  };
}
