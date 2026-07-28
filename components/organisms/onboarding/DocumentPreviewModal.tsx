"use client";

import { useEffect } from "react";

import { buttonClassName, Icon } from "../../atoms";
import type { DocumentPreview } from "./types";
import { formatFileSize } from "./utils";

export function DocumentPreviewModal({
  onClose,
  preview,
}: {
  onClose: () => void;
  preview: DocumentPreview | null;
}) {
  useEffect(() => {
    if (!preview) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, preview]);

  if (!preview) return null;

  const isImage = preview.file.type.startsWith("image/");
  const title = `${preview.file.name} preview`;

  return (
    <div
      aria-labelledby="document-preview-title"
      aria-modal="true"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-3 sm:p-6"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-6xl cursor-default flex-col overflow-hidden rounded-2xl border border-white/15 bg-white shadow-[0_30px_80px_rgb(0_0_0/0.35)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-white px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand">
              <Icon name={isImage ? "image" : "file"} size={19} />
            </div>
            <div className="min-w-0">
              <h2 id="document-preview-title" className="truncate font-serif text-xl leading-tight text-ink">
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
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-ink transition hover:bg-chalk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              onClick={onClose}
              type="button"
            >
              <Icon name="x" size={18} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 bg-[#101217] p-3 sm:p-4">
          <div className="flex h-[70vh] min-h-[420px] items-center justify-center overflow-hidden rounded-xl bg-[#f8fafc]">
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={title}
                className="h-full w-full object-contain"
                src={preview.url}
              />
            ) : (
              <iframe
                className="h-full w-full border-0 bg-white"
                src={preview.url}
                title={title}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
