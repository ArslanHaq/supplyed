"use client";

import { buttonClassName, Icon } from "../../atoms";
import { Modal } from "../../molecules/Modal";
import type { DocumentPreview } from "./types";
import { formatFileSize } from "./utils";

export function DocumentPreviewModal({
  onClose,
  preview,
}: {
  onClose: () => void;
  preview: DocumentPreview | null;
}) {
  if (!preview) return null;

  const isImage = preview.file.type.startsWith("image/");
  const title = `${preview.file.name} preview`;

  return (
    <Modal open={Boolean(preview)} onClose={onClose} size="xl" label={title}>
      <div className="document-preview flex w-full flex-col overflow-hidden rounded-2xl bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand">
              <Icon name={isImage ? "image" : "file"} size={19} />
            </div>
            <div className="min-w-0">
              <h2 id="document-preview-title" className="truncate font-heading text-xl leading-tight text-ink">
                {preview.file.name}
              </h2>
              <p className="mt-1 text-xs font-medium text-muted">
                {preview.file.type || "Document"} · {formatFileSize(preview.file.size)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              className={buttonClassName({ className: "hidden sm:inline-flex", size: "sm", variant: "secondary" })}
              href={preview.url}
              rel="noreferrer"
              target="_blank"
            >
              Open in new tab
            </a>
            <button
              aria-label="Close document preview"
              className={buttonClassName({ variant: "secondary", className: "w-11 p-0" })}
              onClick={onClose}
              type="button"
            >
              <Icon name="x" size={18} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 bg-ink p-3 sm:p-4">
          <div className="document-preview-frame flex items-center justify-center overflow-hidden rounded-lg bg-surface-subtle">
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={title}
                className="h-full w-full object-contain"
                src={preview.url}
              />
            ) : (
              <iframe
                className="h-full w-full border-0 bg-surface"
                src={preview.url}
                title={title}
              />
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
