"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";

import { cn } from "@/lib/cn";

let openDialogs = 0;
let previousOverflow = "";
const focusableSelector = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), iframe, [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

export function Modal({
  children,
  onClose,
  open,
  scrollMode = "dialog",
  size = "md",
  label = "Dialog",
}: {
  children: ReactNode;
  onClose: () => void;
  open: boolean;
  scrollMode?: "dialog" | "viewport";
  size?: "md" | "lg" | "xl";
  label?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const headingId = useId();
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    if (openDialogs++ === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    const heading = panel.querySelector("h1, h2, h3");
    if (heading) {
      if (!heading.id) heading.id = headingId;
      panel.setAttribute("aria-labelledby", heading.id);
    }
    panel.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter((item) => item.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) { event.preventDefault(); panel.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
    panel.addEventListener("keydown", onKeyDown);
    return () => {
      panel.removeEventListener("keydown", onKeyDown);
      if (--openDialogs === 0) document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open, headingId]);
  if (!open) return null;

  return (
    <div
      className={cn(
        "modal-overlay fixed inset-0 z-50 flex justify-center p-4 sm:p-6",
        scrollMode === "viewport" ? "items-start overflow-y-auto" : "items-center",
      )}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        aria-label={label}
        aria-modal="true"
        role="dialog"
        tabIndex={-1}
        className={cn(
          "modal-panel w-full cursor-default rounded-xl border border-border bg-white shadow-panel",
          scrollMode === "viewport" ? "my-auto overflow-visible" : "max-h-[90dvh] overflow-y-auto",
          size === "xl" ? "max-w-4xl" : size === "lg" ? "max-w-2xl" : "max-w-lg",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
