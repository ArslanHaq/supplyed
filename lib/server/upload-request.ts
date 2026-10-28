import "server-only";

import { ApiError } from "./api-error";

export const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  try {
    if (origin && new URL(origin).host === host) return;
  } catch {
    // Invalid origin headers are rejected rather than escaping the route's error handling.
  }
  throw new ApiError("Upload files from your SupplyED account.", 403);
}

/** Bound actual bytes, including chunked bodies and extra multipart fields, before parsing. */
export async function readLimitedFormData(request: Request, maxFileBytes: number): Promise<FormData> {
  if (!Number.isSafeInteger(maxFileBytes) || maxFileBytes < 1) {
    throw new ApiError("The upload limit could not be verified. Please try again.", 503);
  }
  const limit = maxFileBytes + MULTIPART_OVERHEAD_BYTES;
  const tooLarge = () => new ApiError("This upload exceeds the allowed file size.", 413);
  if (Number(request.headers.get("content-length")) > limit) throw tooLarge();
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data;") || !request.body) {
    throw new ApiError("Choose a file to upload.", 400);
  }
  let bytes = 0;
  const body = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytes += chunk.byteLength;
      if (bytes > limit) throw tooLarge();
      controller.enqueue(chunk);
    },
  }), { signal: AbortSignal.any([request.signal, AbortSignal.timeout(120_000)]) });
  try {
    const form = await new Response(body, { headers: { "Content-Type": request.headers.get("content-type")! } }).formData();
    let files = 0;
    let fields = 0;
    for (const value of form.values()) {
      if (typeof value !== "string") files += 1;
      else fields += 1;
    }
    if (files !== 1) throw new ApiError("Choose one file to upload.", 400);
    if (fields > 20) throw new ApiError("The upload contains too many form fields. Refresh the page and try again.", 400);
    return form;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (bytes > limit) throw tooLarge();
    if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) throw error;
    throw new ApiError("The upload could not be read. Choose the file again.", 400);
  }
}
