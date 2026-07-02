"use client";

import { useState } from "react";

import { defaultTweaks } from "@/data/supplyed";
import { loadTweaks, saveTweaks } from "@/lib/supplyed-storage";
import { applyBrandTheme, brandPalettes, deriveBrandTheme } from "@/lib/theme";
import { Icon } from "../atoms";

export function PublicThemeControls() {
  const [accent, setAccent] = useState(() => deriveBrandTheme(defaultTweaks.accent).accent);
  const [open, setOpen] = useState(false);
  const safeAccent = deriveBrandTheme(accent).accent;
  function openControls() {
    setAccent(deriveBrandTheme(loadTweaks().accent).accent);
    setOpen(true);
  }

  function selectAccent(nextAccent: string) {
    const normalizedAccent = deriveBrandTheme(nextAccent).accent;
    const savedTweaks = loadTweaks();
    const nextTweaks = { ...savedTweaks, accent: normalizedAccent };

    setAccent(normalizedAccent);
    applyBrandTheme(normalizedAccent);
    saveTweaks(nextTweaks);
  }

  if (!open) {
    return (
      <button
        aria-label="Open theme colors"
        className="fixed bottom-5 right-5 z-[70] flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white/95 text-ink shadow-panel backdrop-blur transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        onClick={openControls}
        type="button"
      >
        <span className="absolute bottom-2 right-2 h-3 w-3 rounded-full border border-white" style={{ background: safeAccent }} />
        <Icon name="palette" size={17} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-[70] flex items-center gap-2 rounded-full border border-border bg-white/95 py-2 pl-3 pr-2 shadow-panel backdrop-blur">
      {brandPalettes.map((palette) => {
        const selected = safeAccent.toLowerCase() === palette.accent.toLowerCase();

        return (
          <button
            key={palette.accent}
            aria-label={palette.name}
            aria-pressed={selected}
            className="h-5 w-5 rounded-full border border-white transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2 cursor-pointer"
            onClick={() => selectAccent(palette.accent)}
            style={{
              background: palette.accent,
              boxShadow: selected ? "0 0 0 2px #fff, 0 0 0 3px var(--ink)" : "0 0 0 1px rgba(15, 23, 42, 0.12)",
            }}
            title={palette.name}
            type="button"
          />
        );
      })}

      <button
        aria-label="Close theme colors"
        className="ml-1 flex h-7 w-7 items-center justify-center cursor-pointer rounded-full text-muted transition hover:bg-chalk hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(false);
        }}
        type="button"
      >
        <Icon name="x" size={15} />
      </button>
    </div>
  );
}
