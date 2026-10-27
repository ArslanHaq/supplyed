import "server-only";

import { randomUUID } from "node:crypto";
import { ApiError } from "./api-client";

export function routeError(error: unknown) {
  if (error instanceof ApiError) {
    const payload = error.payload ?? { code: error.code, message: error.message };
    return Response.json(payload, { status: error.status, headers: { ...(error.requestId ? { "X-Request-Id": error.requestId } : {}), ...(error.retryAfter !== undefined ? { "Retry-After": String(error.retryAfter) } : {}) } });
  }

  const requestId = randomUUID();
  const timeout = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
  // Never log request bodies, credentials, signed URLs, or raw provider error messages.
  console.error(JSON.stringify({ event: "route_failure", requestId, errorType: error instanceof Error ? error.name : "Unknown", status: timeout ? 504 : 500 }));
  return Response.json(
    { message: timeout ? "The request took too long. Please try again." : "Unexpected server error.", requestId },
    { status: timeout ? 504 : 500, headers: { "X-Request-Id": requestId } },
  );
}
