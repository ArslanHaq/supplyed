import "server-only";

import { ApiError } from "./api-client";

export function routeError(error: unknown) {
  if (error instanceof ApiError) {
    const payload = error.payload ?? { message: error.message };
    return Response.json(payload, { status: error.status });
  }

  return Response.json({ message: "Unexpected server error." }, { status: 500 });
}
