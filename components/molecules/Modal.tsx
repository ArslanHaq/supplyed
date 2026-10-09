import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Modal({
  children,
  onClose,
  open,
  scrollMode = "dialog",
  size = "md",
}: {
  children: ReactNode;
  onClose: () => void;
  open: boolean;
  scrollMode?: "dialog" | "viewport";
  size?: "md" | "lg" | "xl";
}) {
  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex cursor-pointer justify-center bg-black/35 p-4 backdrop-blur-[2px] sm:p-6",
        scrollMode === "viewport" ? "items-start overflow-y-auto" : "items-center",
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full cursor-default rounded-xl border border-border bg-white shadow-panel",
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
