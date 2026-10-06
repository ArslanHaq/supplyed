"use client";

import { useEffect, useId, useRef, useState } from "react";

import { attachmentDownloadUrlAction } from "@/features/conversations/actions";
import { formatFileSize } from "@/features/conversations/schemas";
import type { MessageAttachment } from "@/features/conversations/types";
import type { ToastFn } from "@/types/supplyed";

import { Btn, Icon } from "../atoms";

export function MessageAttachmentPreview({
  attachment,
  conversationId,
  light,
  toast,
}: {
  attachment: MessageAttachment;
  conversationId: string;
  light: boolean;
  toast: ToastFn;
}) {
  const isImage = attachment.contentType === "image/jpeg" || attachment.contentType === "image/png";
  const isText = attachment.contentType === "text/plain";
  const isPdf = attachment.contentType === "application/pdf";
  const supported = isImage || isText || isPdf;
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<{ url: string; text: string } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // Only load thumbnails near the visible messages; PDF bytes are loaded on expansion.
  const shouldLoad = supported && visible;

  useEffect(() => {
    const card = cardRef.current;
    if (!card || !supported || isPdf) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "120px" });
    observer.observe(card);
    return () => observer.disconnect();
  }, [isPdf, supported]);

  useEffect(() => {
    if (!shouldLoad) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;

    async function load() {
      try {
        const response = await fetch(
          `/api/conversations/${encodeURIComponent(conversationId)}/attachments/${encodeURIComponent(attachment.id)}/preview`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) throw new Error("Preview unavailable. You can still download the file.");
        const blob = await response.blob();
        if (blob.type.split(";")[0] !== attachment.contentType) throw new Error("This file cannot be previewed. Download it to view it.");
        const text = isText ? await blob.text() : "";
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setPreview({ url: objectUrl, text });
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Preview unavailable.");
      }
    }
    void load();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.contentType, attachment.id, attempt, conversationId, isText, shouldLoad]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const card = cardRef.current;
    if (!open || !dialog) return;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      card?.focus();
    };
  }, [open]);

  async function download() {
    setDownloading(true);
    try {
      const result = await attachmentDownloadUrlAction(conversationId, attachment.id);
      if (!result.ok) throw new Error(result.message);
      // An anchor avoids popup blockers after the asynchronous URL request.
      const link = document.createElement("a");
      link.href = result.data;
      link.download = attachment.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (reason) {
      toast({ msg: reason instanceof Error ? reason.message : "Please try again.", title: "Could not download file", tone: "danger" });
    } finally {
      setDownloading(false);
    }
  }

  const fileLabel = isPdf ? "PDF" : isImage ? "Image" : isText ? "Text" : /word/.test(attachment.contentType) ? "Word document" : "File";

  return (
    <>
      <button
        ref={cardRef}
        aria-label={`Preview ${attachment.fileName}`}
        aria-haspopup="dialog"
        className={`mt-2 block w-60 max-w-full overflow-hidden rounded-xl border text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${light ? "border-white/25 bg-white/15" : "border-border bg-white"}`}
        onClick={() => { setVisible(true); setOpen(true); }}
        type="button"
      >
        <span className="flex h-28 items-center justify-center overflow-hidden bg-black/5">
          {isImage && preview && !error ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={attachment.fileName} className="h-full w-full object-cover" onError={() => setError("Preview unavailable. You can still download the file.")} src={preview.url} />
          ) : isText && preview && !error ? (
            <span className="h-full w-full whitespace-pre-wrap break-words p-3 font-mono text-[10px] leading-4">{preview.text.slice(0, 600) || "Empty text file"}</span>
          ) : (
            <span className="flex flex-col items-center gap-2 text-xs">
              <Icon name={isImage ? "image" : "file"} size={30} />
              {error ? "Preview unavailable" : fileLabel}
            </span>
          )}
        </span>
        <span className="block px-3 py-2">
          <span className="block truncate text-xs font-semibold" title={attachment.fileName}>{attachment.fileName}</span>
          <span className="mt-1 flex items-center justify-between gap-2 text-[11px] opacity-75">
            <span>{formatFileSize(attachment.sizeBytes)}</span>
            <span className="flex items-center gap-1"><Icon name="eye" size={12} /> View file</span>
          </span>
        </span>
      </button>

      {open ? (
        <dialog
          ref={dialogRef}
          aria-labelledby={titleId}
          className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl overflow-hidden rounded-2xl border border-border bg-white p-0 text-ink shadow-2xl backdrop:bg-black/60"
          onCancel={() => setOpen(false)}
          onClose={() => setOpen(false)}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setOpen(false);
          }}
        >
          <header className="flex items-center gap-3 border-b border-border p-4">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="truncate font-semibold" title={attachment.fileName}>{attachment.fileName}</h2>
              <p className="text-xs text-muted">{fileLabel} · {formatFileSize(attachment.sizeBytes)}</p>
            </div>
            <button aria-label="Close file preview" autoFocus className="rounded-lg p-2 hover:bg-chalk focus-visible:outline-brand" onClick={() => setOpen(false)} type="button">
              <Icon name="x" size={20} />
            </button>
          </header>
          <div className="flex h-[60dvh] items-center justify-center overflow-auto bg-chalk p-3">
            {!supported || error ? (
              <div className="flex max-w-sm flex-col items-center gap-3 text-center text-sm text-muted" role={error ? "status" : undefined}>
                <Icon name="file" size={44} />
                <p>{error || "Preview is not available for this file type. Download it to view it."}</p>
                {error ? <Btn size="sm" variant="secondary" onClick={() => { setPreview(null); setError(""); setAttempt((value) => value + 1); }}>Retry preview</Btn> : null}
              </div>
            ) : !preview ? (
              <p className="text-sm text-muted" role="status">Loading preview...</p>
            ) : isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={attachment.fileName} className="h-full w-full object-contain" onError={() => setError("Preview unavailable. You can still download the file.")} src={preview.url} />
            ) : isText ? (
              <pre className="h-full w-full whitespace-pre-wrap break-words p-3 text-sm">{preview.text.slice(0, 100_000) || "Empty text file"}{preview.text.length > 100_000 ? "\n\nPreview truncated. Download the file to read the full text." : ""}</pre>
            ) : (
              <object aria-label={`${attachment.fileName} preview`} className="h-full w-full" data={preview.url} type="application/pdf">
                <p className="p-4 text-center text-sm text-muted">Your browser cannot display this PDF. Download it to view it.</p>
              </object>
            )}
          </div>
          <footer className="flex justify-end border-t border-border p-3">
            <Btn icon="download" size="sm" loading={downloading} loadingLabel="Downloading" onClick={download}>Download</Btn>
          </footer>
        </dialog>
      ) : null}
    </>
  );
}
