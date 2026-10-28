import { api } from "@/lib/server/api-client";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DownloadDocumentResponse = {
  downloadUrl?: string;
  url?: string;
};

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function inlineContentDisposition(filename: string) {
  const safeName = filename.replace(/[/\\\r\n"]/g, "").trim() || "document";
  return `inline; filename*=UTF-8''${encodeURIComponent(safeName)}`;
}

export async function GET(request: Request, context: { params: Promise<{ documentId: string }> }) {
  try {
    const { documentId } = await context.params;
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get("name") ?? "document";

    const download = await api.get<DownloadDocumentResponse>(`/documents/${encodeURIComponent(documentId)}/download-url`, { cache: "no-store" });
    const sourceUrl = readString(download.downloadUrl) ?? readString(download.url);

    if (!sourceUrl) {
      return Response.json({ message: "Document preview URL was not returned." }, { status: 502 });
    }

    const sourceResponse = await fetch(sourceUrl, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]),
    });

    if (!sourceResponse.ok) {
      await sourceResponse.body?.cancel();
      return Response.json(
        { message: "Document preview could not be loaded." },
        { status: sourceResponse.status },
      );
    }

    const contentType = sourceResponse.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "application/octet-stream";
    const previewTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "image/heic", "image/bmp", "text/plain"]);
    // Keep non-previewable documents downloadable without executing active content.
    const disposition = inlineContentDisposition(filename).replace(/^inline/, previewTypes.has(contentType) ? "inline" : "attachment");
    return new Response(sourceResponse.body, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": disposition,
        "Content-Type": previewTypes.has(contentType) ? contentType : "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox",
      },
      status: 200,
    });
  } catch (error) {
    return routeError(error);
  }
}
