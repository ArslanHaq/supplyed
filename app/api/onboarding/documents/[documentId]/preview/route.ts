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

    const download = await api.get<DownloadDocumentResponse>(`/documents/${documentId}/download-url`);
    const sourceUrl = readString(download.downloadUrl) ?? readString(download.url);

    if (!sourceUrl) {
      return Response.json({ message: "Document preview URL was not returned." }, { status: 502 });
    }

    const sourceResponse = await fetch(sourceUrl, {
      cache: "no-store",
      redirect: "follow",
    });

    if (!sourceResponse.ok) {
      return Response.json(
        { message: "Document preview could not be loaded." },
        { status: sourceResponse.status },
      );
    }

    return new Response(sourceResponse.body, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": inlineContentDisposition(filename),
        "Content-Type": sourceResponse.headers.get("content-type") ?? "application/octet-stream",
      },
      status: 200,
    });
  } catch (error) {
    return routeError(error);
  }
}
