"use client";
import { useDropdown } from "@/features/dropdowns/use-dropdown";
import { DropdownStatus } from "@/components/molecules/DynamicDropdown";


import { useEffect, useRef, useState } from "react";

import { useTweaks } from "@/lib/use-tweaks";
import { applyBrandTheme, deriveBrandTheme } from "@/lib/theme";
import { Icon } from "../atoms";

export function PublicThemeControls() {
  const choices = useDropdown("themeAccent");
  const brandPalettes = (choices.data?.options ?? []).map(option => ({ name: option.label, accent: option.value }));
  const [tweaks, setTweaks] = useTweaks();
  const [open, setOpen] = useState(false);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const safeAccent = deriveBrandTheme(tweaks.accent).accent;

  function closeControls() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  useEffect(() => {
    if (!open) return;
    controlsRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    function dismiss(event: PointerEvent) {
      if (!controlsRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  function openControls() {
    setOpen(true);
  }

  function selectAccent(nextAccent: string) {
    const normalizedAccent = deriveBrandTheme(nextAccent).accent;
    applyBrandTheme(normalizedAccent);
    setTweaks(current => ({ ...current, accent: normalizedAccent }));
  }

  if (!open) {
    return (
      <button
        ref={triggerRef}
        aria-label="Open theme colors"
        aria-expanded={false}
        className="fixed bottom-5 right-5 z-[70] flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface/95 text-ink shadow-panel backdrop-blur transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        onClick={openControls}
        type="button"
      >
        <span className="absolute bottom-2 right-2 h-3 w-3 rounded-full border border-surface" style={{ background: safeAccent }} />
        <Icon name="palette" size={17} />
      </button>
    );
  }

  return (
    <div
      ref={controlsRef}
      role="group"
      aria-label="Theme colors"
      className="fixed bottom-5 right-5 z-[70] flex max-w-[calc(100vw-40px)] flex-wrap items-center gap-1 rounded-panel border border-border bg-surface/95 p-2 shadow-panel backdrop-blur"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeControls();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <DropdownStatus name="themeAccent" />{brandPalettes.map((palette) => {
        const selected = safeAccent.toLowerCase() === palette.accent.toLowerCase();

        return (
          <button
            key={palette.accent}
            aria-label={palette.name}
            aria-pressed={selected}
            className="h-8 w-8 shrink-0 rounded-full border border-surface transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 cursor-pointer"
            onClick={() => selectAccent(palette.accent)}
            style={{
              background: palette.accent,
              boxShadow: selected ? "0 0 0 2px var(--surface), 0 0 0 3px var(--ink)" : "0 0 0 1px var(--border)",
            }}
            title={palette.name}
            type="button"
          />
        );
      })}

      <button
        aria-label="Close theme colors"
        className="flex h-8 w-8 shrink-0 items-center justify-center cursor-pointer rounded-full text-muted transition hover:bg-chalk hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        onClick={(event) => {
          event.stopPropagation();
          closeControls();
        }}
        type="button"
      >
        <Icon name="x" size={15} />
      </button>
    </div>
  );
}
