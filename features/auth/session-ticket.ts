import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import type { BackendAuthResponse } from "./types";

const ticketTtlMs = 60_000;

type VerifiedEmailTicketPayload = BackendAuthResponse & {
  expiresAt: number;
};

function getTicketSecret() {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    (process.env.NODE_ENV === "production" ? undefined : "supplyed-local-dev-auth-secret-change-before-production");

  if (!secret) {
    throw new Error("AUTH_SECRET is required to create verified email session tickets.");
  }

  return secret;
}

function getTicketKey() {
  return createHash("sha256").update(getTicketSecret()).digest();
}

function encryptPayload(payload: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getTicketKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

function decryptPayload(ticket: string) {
  const [ivText, tagText, ciphertextText] = ticket.split(".");
  if (!ivText || !tagText || !ciphertextText) return null;

  try {
    const decipher = createDecipheriv("aes-256-gcm", getTicketKey(), Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextText, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

function isBackendAuthResponse(value: unknown): value is BackendAuthResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const response = value as Partial<BackendAuthResponse>;
  const user = response.user;

  return Boolean(
    user &&
      typeof user === "object" &&
      typeof user.id === "string" &&
      typeof user.email === "string" &&
      user.emailVerified === true,
  );
}

export function createVerifiedEmailSessionTicket(response: BackendAuthResponse) {
  if (!response.user.emailVerified) {
    throw new Error("Cannot create a session ticket for an unverified email.");
  }

  return encryptPayload(
    JSON.stringify({
      ...response,
      expiresAt: Date.now() + ticketTtlMs,
    } satisfies VerifiedEmailTicketPayload),
  );
}

export function readVerifiedEmailSessionTicket(ticket: string): BackendAuthResponse | null {
  const payload = decryptPayload(ticket);
  if (!payload) return null;

  try {
    const parsed = JSON.parse(payload) as VerifiedEmailTicketPayload;

    if (!Number.isFinite(parsed.expiresAt) || parsed.expiresAt < Date.now()) return null;
    if (!isBackendAuthResponse(parsed)) return null;

    return {
      accessToken: parsed.accessToken,
      accessTokenExpiresAt: parsed.accessTokenExpiresAt,
      refreshToken: parsed.refreshToken,
      user: parsed.user,
    };
  } catch {
    return null;
  }
}
