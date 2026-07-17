"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Toast } from "@/types/supplyed";

import { Icon } from "../atoms";

const toastExitMs = 180;

type ToastStackProps = {
  autoCloseMs?: number;
  onDismiss?: (id: string) => void;
  toasts: Toast[];
};

function clearTimer(timerMap: Record<string, number>, id: string) {
  const timer = timerMap[id];
  if (timer !== undefined) window.clearTimeout(timer);
  delete timerMap[id];
}

export function ToastStack({ autoCloseMs = 5000, onDismiss, toasts }: ToastStackProps) {
  const [closingIds, setClosingIds] = useState<Set<string>>(() => new Set());
  const autoTimersRef = useRef<Record<string, number>>({});
  const closeTimersRef = useRef<Record<string, number>>({});

  const beginDismiss = useCallback(
    (id: string) => {
      if (!onDismiss) return;

      clearTimer(autoTimersRef.current, id);
      setClosingIds((current) => {
        if (current.has(id)) return current;
        const next = new Set(current);
        next.add(id);
        return next;
      });

      if (closeTimersRef.current[id] !== undefined) return;

      closeTimersRef.current[id] = window.setTimeout(() => {
        onDismiss(id);
        clearTimer(closeTimersRef.current, id);
        setClosingIds((current) => {
          if (!current.has(id)) return current;
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }, toastExitMs);
    },
    [onDismiss],
  );

  useEffect(() => {
    if (!onDismiss || autoCloseMs <= 0) return;

    const toastIds = new Set(toasts.map((toast) => toast.id));

    Object.keys(autoTimersRef.current).forEach((id) => {
      if (!toastIds.has(id)) clearTimer(autoTimersRef.current, id);
    });

    Object.keys(closeTimersRef.current).forEach((id) => {
      if (!toastIds.has(id)) clearTimer(closeTimersRef.current, id);
    });

    toasts.forEach((toast) => {
      if (closingIds.has(toast.id) || autoTimersRef.current[toast.id] !== undefined) return;
      autoTimersRef.current[toast.id] = window.setTimeout(() => beginDismiss(toast.id), autoCloseMs);
    });
  }, [autoCloseMs, beginDismiss, closingIds, onDismiss, toasts]);

  useEffect(() => {
    const autoTimers = autoTimersRef.current;
    const closeTimers = closeTimersRef.current;

    return () => {
      Object.keys(autoTimers).forEach((id) => clearTimer(autoTimers, id));
      Object.keys(closeTimers).forEach((id) => clearTimer(closeTimers, id));
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack" aria-live="polite" role="status">
      {toasts.map((toast) => {
        const closing = closingIds.has(toast.id);

        return (
          <div
            key={toast.id}
            className={`toast ${toast.tone === "danger" ? "toast-danger" : "toast-success"} ${closing ? "toast-leaving" : ""}`}
          >
            <div className="toast-icon">
              <Icon name={toast.icon || "check"} size={13} />
            </div>
            <div className="toast-copy">
              <div className="toast-title">{toast.title}</div>
              <div className="toast-message">{toast.msg}</div>
            </div>
            {onDismiss ? (
              <button className="toast-close" type="button" aria-label={`Dismiss ${toast.title}`} onClick={() => beginDismiss(toast.id)}>
                <Icon name="x" size={15} />
              </button>
            ) : null}
            {onDismiss && autoCloseMs > 0 ? (
              <div className="toast-progress" style={{ animationDuration: `${autoCloseMs}ms` }} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
