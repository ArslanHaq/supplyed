import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/lib/query/fetch-json";
import type { DocumentWorkspace } from "@/features/documents/types";
import { acceptAttribute, documentFileValidationError, formatByteLimit } from "@/features/onboarding/document-utils";
import { Btn, Tag } from "../atoms";

export function ApplicationDocuments({ applicationId }: { applicationId?: string }) {
  const [expanded, setExpanded] = useState(!applicationId);
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState<string>();
  const client = useQueryClient();
  const query = useQuery({
    enabled: expanded,
    queryKey: ["documents", applicationId ?? "profile"],
    queryFn: () => fetchJson<DocumentWorkspace>("/api/documents", { query: { applicationId } }),
    refetchOnWindowFocus: true,
  });
  async function upload(requirementId: string, file: File) {
    if (pending) return;
    const requirement = query.data?.requirements.find((item) => item.id === requirementId);
    if (!requirement) return;
    const validation = documentFileValidationError(file, requirement);
    if (validation) {
      setError(validation);
      return;
    }
    setPending(requirementId);
    setError(undefined);
    try {
      const body = new FormData();
      body.set("requirementId", requirementId);
      body.set("file", file);
      if (applicationId) body.set("applicationId", applicationId);
      const response = await fetch("/api/documents", { method: "POST", body });
      const result = await response.json();
      if (!response.ok)
        throw new Error(Array.isArray(result.message) ? result.message.join(" ") : result.message || "Upload failed.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Upload failed.");
    } finally {
      setPending(undefined);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["documents"] }),
        client.invalidateQueries({ queryKey: ["onboarding"] }),
      ]);
    }
  }
  return (
    <section className="mt-5 border-t border-border pt-4">
      <Btn variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
        {applicationId ? "Supporting documents" : "Profile documents"} {expanded ? "?" : "+"}
      </Btn>
      {expanded ? (
        <div className="mt-3 space-y-4">
          <p className="text-sm text-muted">
            {applicationId
              ? "Available supporting document types are shown below. The current service does not expose a job-specific checklist."
              : "Upload or replace your profile documents. All documents must be approved for full verification."}
          </p>
          {query.isLoading ? (
            <p role="status">Loading documents...</p>
          ) : query.isError ? (
            <p role="alert">
              {query.error.message}{" "}
              <button className="underline" onClick={() => void query.refetch()}>
                Retry
              </button>
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          {query.data?.requirements.map((requirement) => {
            const document = query.data.documents.find((item) => item.requirementId === requirement.id);
            return (
              <div className="rounded-lg border border-border p-4" key={requirement.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{requirement.name}</strong>
                  <Tag tone={document?.status === "APPROVED" ? "green" : "ghost"}>
                    {document?.fileKey ? document.status.toLowerCase().replace(/_/g, " ") : "Not uploaded"}
                  </Tag>
                  {!applicationId && requirement.isRequired ? <Tag tone="amber">Required</Tag> : null}
                </div>
                <p className="mt-1 text-xs text-muted">
                  {requirement.allowedMimes.join(", ")} ? Up to {formatByteLimit(requirement.maxSizeBytes)}
                </p>
                {document?.status === "NOT_REQUIRED" ? (
                  <p className="mt-2 text-sm text-muted">
                    This document currently has no approval review. Ask support to enable review before replacing the
                    file so it can count toward full verification.
                  </p>
                ) : null}
                {document?.originalName ? <p className="mt-2 break-all text-sm">{document.originalName}</p> : null}
                {document?.rejectionComment ? (
                  <p className="mt-2 text-sm text-danger">Review note: {document.rejectionComment}</p>
                ) : null}
                <label className="mt-3 block text-sm">
                  {pending === requirement.id ? "Uploading..." : document?.fileKey ? "Replace file" : "Choose file"}
                  <input
                    className="mt-2 block w-full text-sm"
                    type="file"
                    accept={acceptAttribute(requirement.allowedMimes)}
                    disabled={Boolean(pending)}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void upload(requirement.id, file);
                    }}
                  />
                </label>
                {document?.fileKey ? (
                  <a
                    className="mt-2 inline-block text-sm underline"
                    href={`/api/onboarding/documents/${document.id}/preview`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View uploaded document
                  </a>
                ) : null}
              </div>
            );
          })}
          {query.isSuccess && !query.data.requirements.length ? (
            <p className="text-sm text-muted">No active document requirements are available.</p>
          ) : null}
          {query.data?.documents
            .filter((item) => !query.data.requirements.some((requirement) => requirement.id === item.requirementId))
            .map((document) => (
              <div className="rounded-lg border border-border p-3 text-sm" key={document.id}>
                {document.originalName || "Existing document"} ? {document.status.toLowerCase().replace(/_/g, " ")}
              </div>
            ))}
        </div>
      ) : null}
    </section>
  );
}
