import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Modal({
  children,
  onClose,
  open,
  size = "md",
}: {
  children: ReactNode;
  onClose: () => void;
  open: boolean;
  size?: "md" | "lg" | "xl";
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/35 p-4 backdrop-blur-[2px] sm:p-6" onClick={onClose}>
      <div
        className={cn(
          "max-h-[90dvh] w-full cursor-default overflow-y-auto rounded-xl border border-border bg-white shadow-panel",
          size === "xl" ? "max-w-4xl" : size === "lg" ? "max-w-2xl" : "max-w-lg",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
