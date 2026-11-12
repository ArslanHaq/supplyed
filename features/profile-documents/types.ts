export type ProfileDocument = {
  id: string;
  kind: "CERTIFICATE" | "ACHIEVEMENT";
  title: string;
  description: string | null;
  issueDate: string | null;
  originalName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  fileUrl: string | null;
  fileUrlExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProfileDocumentInput = {
  title: string;
  description?: string;
  issueDate?: string;
};

export type ProfileDocumentUpload = {
  fileKey: string;
  url: string;
  expiresAt: string;
  requiredHeaders: Record<string, string>;
};
