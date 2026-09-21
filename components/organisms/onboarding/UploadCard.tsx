import { cn } from "@/lib/cn";

import { Icon, Tag } from "../../atoms";
import { FileSummary } from "./ReviewCard";
import type { UploadedFile } from "./types";
import { documentStatusTag, toUploadedFile } from "./utils";

export function UploadCard({
  accept,
  actionLabel,
  capture,
  description,
  disabled = false,
  error,
  file,
  icon,
  id,
  meta,
  onFile,
  onView,
  pending = false,
  rejectionComment,
  required,
  status,
  title,
  viewPending = false,
}: {
  accept: string;
  actionLabel: string;
  capture?: "user" | "environment";
  description: string;
  disabled?: boolean;
  error?: string;
  file: UploadedFile | null;
  icon: string;
  id: string;
  meta?: string;
  onFile: (file: UploadedFile) => void;
  onView?: () => void;
  pending?: boolean;
  rejectionComment?: string | null;
  required?: boolean;
  status?: string | null;
  title: string;
  viewPending?: boolean;
}) {
  const effectiveStatus = status ?? file?.status;
  const statusTag = documentStatusTag(effectiveStatus);
  const trimmedRejectionComment = rejectionComment?.trim() || file?.rejectionComment?.trim();
  const showRejectionComment =
    Boolean(trimmedRejectionComment) && ["REJECTED", "REQUIRES_INFO"].includes((effectiveStatus ?? "").toUpperCase());

  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-5 transition",
        error ? "border-danger bg-danger-tint" : file ? "border-brand bg-brand-tint" : pending ? "border-brand bg-brand-tint" : "border-border",
      )}
    >
      <div className="flex min-h-[132px] flex-col">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand">
            <Icon name={icon} size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-semibold">{title}</div>
              {required === undefined ? null : <Tag tone={required ? "" : "ghost"}>{required ? "Required" : "Optional"}</Tag>}
              {statusTag ? <Tag tone={statusTag.tone}>{statusTag.label}</Tag> : null}
            </div>
            <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
            {meta ? <p className="mt-1 text-xs font-medium text-muted">{meta}</p> : null}
          </div>
        </div>

        <div className="mt-auto pt-5">
          {showRejectionComment ? (
            <div className="mb-3 rounded-lg border border-danger/25 bg-white px-3 py-2 text-xs text-danger">
              <div className="font-semibold">Review comment</div>
              <p className="mt-1 whitespace-pre-line leading-5 text-danger/90">{trimmedRejectionComment}</p>
            </div>
          ) : null}
          {file ? (
            <div className="mb-3">
              <FileSummary file={file} />
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <label
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-full border border-border-strong bg-white px-4 py-2 text-sm font-semibold text-ink transition focus-within:outline-none focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2",
                pending || disabled ? "cursor-wait opacity-70" : "cursor-pointer hover:border-brand hover:bg-brand-tint",
              )}
              htmlFor={id}
            >
              <Icon className={pending ? "animate-spin" : undefined} name={pending ? "loader" : file ? "upload" : icon} size={15} />
              {pending ? "Uploading" : file ? "Replace file" : actionLabel}
              <input
                accept={accept}
                capture={capture}
                className="sr-only"
                disabled={pending || disabled}
                id={id}
                onChange={(event) => {
                  const selectedFile = event.target.files?.[0];
                  if (!selectedFile) return;
                  onFile(toUploadedFile(selectedFile));
                  event.target.value = "";
                }}
                type="file"
              />
            </label>

            {file?.id && onView ? (
              <button
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-brand bg-brand-tint px-4 py-2 text-sm font-semibold text-brand transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
                disabled={viewPending}
                onClick={onView}
                type="button"
              >
                <Icon className={viewPending ? "animate-spin" : undefined} name={viewPending ? "loader" : "eye"} size={15} />
                {viewPending ? "Opening" : "View"}
              </button>
            ) : null}
          </div>
          {error ? <div className="mt-2 text-xs font-semibold text-danger">{error}</div> : null}
        </div>
      </div>
    </div>
  );
}
