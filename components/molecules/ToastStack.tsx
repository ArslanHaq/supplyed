import type { Toast } from "@/types/supplyed";

import { Icon } from "../atoms";

export function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed bottom-5 right-5 z-[60] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2">
      {toasts.map((toast) => (
        <div key={toast.id} className="flex gap-3 rounded-xl border border-[var(--border)] bg-white p-3 shadow-[var(--shadow-lg)]">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--se-tint)] text-[var(--se)]">
            <Icon name={toast.icon || "check"} size={13} />
          </div>
          <div>
            <div className="font-semibold">{toast.title}</div>
            <div className="text-sm text-[var(--slate)]">{toast.msg}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
