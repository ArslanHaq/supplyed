import { MAX_ATTACHMENT_BYTES } from "@/features/conversations/schemas";
import { api } from "@/lib/server/api-client";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

const previewTypes = new Set(["image/jpeg", "image/png", "application/pdf", "text/plain"]);

/** Fetch through the server: signed downloads force attachment disposition and the bucket need not allow CORS. */
export async function GET(request: Request, context: { params: Promise<{ id: string; attachmentId: string }> }) {
  try {
    const { id, attachmentId } = await context.params;
    // The existing API checks membership and attachment ownership before issuing a URL.
    const link = await api.get<{ url: string }>(
      `/conversations/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}/download-url`,
      { cache: "no-store" },
    );
    const stored = await fetch(link.url, {
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]),
    });
    if (!stored.ok) {
      return Response.json({ message: "The file preview could not be loaded." }, { status: 502 });
    }

    const contentType = stored.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
    if (!previewTypes.has(contentType)) {
      await stored.body?.cancel();
      return Response.json({ message: "Download this file to view it." }, { status: 415 });
    }
    if (Number(stored.headers.get("content-length")) > MAX_ATTACHMENT_BYTES) {
      await stored.body?.cancel();
      return Response.json({ message: "This file is too large to preview." }, { status: 413 });
    }

    return new Response(stored.body, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "Content-Type": contentType === "text/plain" ? "text/plain; charset=utf-8" : contentType,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox",
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
