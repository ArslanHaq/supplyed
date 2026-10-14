import { ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES } from "@/features/conversations/schemas";
import type { AttachmentUpload } from "@/features/conversations/types";
import { api } from "@/lib/server/api-client";
import { routeError } from "@/lib/server/route-error";

export const dynamic = "force-dynamic";

/**
 * Uploads a file for a conversation: the API records it and returns a signed
 * S3 link, and this server PUTs the file to it, as the document uploads do, so
 * the bucket needs no browser (CORS) access. The API checks the stored file's
 * size and type again when the message is sent.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const file = (await request.formData()).get("file");

    if (!(file instanceof File)) return Response.json({ message: "Choose a file to upload." }, { status: 400 });
    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
      return Response.json({ message: "Only PDF, Word, JPEG, PNG and text files can be shared." }, { status: 400 });
    }
    if (file.size < 1 || file.size > MAX_ATTACHMENT_BYTES) {
      return Response.json({ message: "Files can be up to 10 MB." }, { status: 400 });
    }

    const started = await api.post<AttachmentUpload>(`/conversations/${id}/attachments`, {
      contentType: file.type,
      fileName: file.name,
      sizeBytes: file.size,
    });
    const stored = await fetch(started.upload.url, {
      body: file,
      headers: started.upload.requiredHeaders,
      method: "PUT",
    });

    if (!stored.ok) {
      return Response.json({ message: `${file.name} could not be uploaded. Please try again.` }, { status: 502 });
    }

    return Response.json(started.attachment);
  } catch (error) {
    return routeError(error);
  }
}
