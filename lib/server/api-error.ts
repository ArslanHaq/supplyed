import { userFacingError } from "@/lib/user-facing-error";
import { apiErrorDetails } from "@/lib/api-error-details";

export class ApiError extends Error {
  // Captured at the failed request boundary, not during component rendering.
  readonly receivedAt = Date.now();
  readonly fieldErrors?: Record<string, string>;
  readonly retryAfter?: number;
  constructor(
    message: string,
    readonly status: number,
    readonly payload?: unknown,
    readonly code?: string,
    readonly requestId?: string,
    retryHeader?: string | null,
  ) {
    super(userFacingError(message, { status, code }));
    this.name = "ApiError";
    const details = apiErrorDetails(payload, retryHeader);
    this.fieldErrors = details.fieldErrors;
    this.retryAfter = status === 429 ? details.retryAfter ?? 60 : details.retryAfter;
  }
}
