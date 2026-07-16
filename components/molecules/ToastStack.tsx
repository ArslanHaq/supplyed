import type { Toast } from "@/types/supplyed";

import { Icon } from "../atoms";

export function ToastStack({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack" aria-live="polite" role="status">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.tone === "danger" ? "toast-danger" : "toast-success"}`}>
          <div className="toast-icon">
            <Icon name={toast.icon || "check"} size={13} />
          </div>
          <div className="min-w-0">
            <div className="toast-title">{toast.title}</div>
            <div className="toast-message">{toast.msg}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
