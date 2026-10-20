import { userFacingError } from "@/lib/user-facing-error";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload?: unknown,
    readonly code?: string,
    readonly requestId?: string,
  ) {
    super(userFacingError(message, { status, code }));
    this.name = "ApiError";
  }
}
