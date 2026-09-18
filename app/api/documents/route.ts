import { getDocumentWorkspace } from "@/features/documents/queries";
import type { OwnedDocument } from "@/features/documents/types";
import { contentTypeForFile, documentFileValidationError } from "@/features/onboarding/document-utils";
import { api } from "@/lib/server/api-client";
import { routeError } from "@/lib/server/route-error";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    return Response.json(
      await getDocumentWorkspace(new URL(request.url).searchParams.get("applicationId") || undefined),
    );
  } catch (error) {
    return routeError(error);
  }
}
export async function POST(request: Request) {
  try {
    const data = await request.formData();
    const file = data.get("file");
    const applicationId = String(data.get("applicationId") || "") || undefined;
    const workspace = await getDocumentWorkspace(applicationId);
    const requirement = workspace.requirements.find((item) => item.id === data.get("requirementId"));
    if (!(file instanceof File) || !requirement)
      return Response.json({ message: "Choose a file and an available document type." }, { status: 400 });
    const validation = documentFileValidationError(file, requirement);
    if (validation) return Response.json({ message: validation }, { status: 400 });
    const existing = workspace.documents.find((item) => item.requirementId === requirement.id);
    const document =
      existing ??
      (await api.post<OwnedDocument>("/documents", {
        requirementId: requirement.id,
        ...(applicationId ? { applicationId } : {}),
      }));
    const contentType = contentTypeForFile(file, requirement.allowedMimes);
    const upload = await api.post<{ url: string; fileKey: string; requiredHeaders: Record<string, string> }>(
      `/documents/${document.id}/upload-url`,
      { contentType, sizeBytes: file.size },
    );
    const response = await fetch(upload.url, {
      method: "PUT",
      headers: upload.requiredHeaders,
      body: file,
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok)
      return Response.json({ message: "File upload failed. Please select the file again to retry." }, { status: 502 });
    const completed = await api.post<OwnedDocument>(`/documents/${document.id}/upload-complete`, {
      fileKey: upload.fileKey,
      originalName: file.name.replace(/[\r\n/\\]/g, "").slice(0, 255) || "document",
    });
    return Response.json(completed);
  } catch (error) {
    return routeError(error);
  }
}
