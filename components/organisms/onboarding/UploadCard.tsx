import { cn } from "@/lib/cn";

import { Btn, buttonClassName, Icon, Tag } from "../../atoms";
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
        "onboarding-upload-card min-w-0 rounded-xl border bg-surface p-5 transition",
        error ? "border-danger bg-danger-tint" : file ? "border-brand bg-brand-tint" : pending ? "border-brand bg-brand-tint" : "border-border",
      )}
      aria-busy={pending}
      data-uploaded={Boolean(file)}
    >
      <div className="flex min-h-[132px] flex-col">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand">
            <Icon name={icon} size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-semibold" id={`${id}-title`}>{title}</div>
              {required === undefined ? null : <Tag tone={required ? "" : "ghost"}>{required ? "Required" : "Optional"}</Tag>}
              {statusTag ? <Tag tone={statusTag.tone}>{statusTag.label}</Tag> : null}
            </div>
            <p className="mt-1 text-sm leading-6 text-muted" id={`${id}-description`}>{description}</p>
            {meta ? <p className="mt-1 text-xs font-medium text-muted" id={`${id}-meta`}>{meta}</p> : null}
          </div>
        </div>

        <div className="mt-auto pt-5">
          {showRejectionComment ? (
            <div className="mb-3 rounded-lg border border-danger/25 bg-surface px-3 py-2 text-xs text-danger">
              <div className="font-semibold">Review comment</div>
              <p className="mt-1 whitespace-pre-line leading-5 text-danger">{trimmedRejectionComment}</p>
            </div>
          ) : null}
          {file ? (
            <div className="mb-3">
              <FileSummary file={file} />
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <label
              className={buttonClassName({ variant: "secondary", className: cn(
                "upload-file-action focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2 data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50 data-[pending=true]:cursor-wait",
              ) })}
              data-disabled={pending || disabled || undefined}
              data-pending={pending || undefined}
              htmlFor={id}
            >
              <Icon className={pending ? "animate-spin" : undefined} name={pending ? "loader" : file ? "upload" : icon} size={15} />
              <span id={`${id}-action`}>{pending ? "Uploading" : file ? "Replace file" : actionLabel}</span>
              <input
                accept={accept}
                aria-describedby={[`${id}-description`, meta ? `${id}-meta` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ")}
                aria-invalid={Boolean(error)}
                aria-labelledby={`${id}-title ${id}-action`}
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
              <Btn
                variant="secondary"
                icon="eye"
                loading={viewPending}
                loadingLabel="Opening"
                aria-label={`View ${title}`}
                onClick={onView}
                type="button"
              >
                View
              </Btn>
            ) : null}
          </div>
          {error ? <div className="mt-2 text-xs font-semibold text-danger" id={`${id}-error`} role="alert">{error}</div> : null}
        </div>
      </div>
    </div>
  );
}
