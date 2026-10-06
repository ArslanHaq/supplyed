import type { ReactNode } from "react";

export function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/35 p-4 backdrop-blur-[2px] sm:p-6" onClick={onClose}>
      <div className="max-h-[90dvh] w-full max-w-lg cursor-default overflow-y-auto rounded-xl border border-border bg-white shadow-panel" onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
