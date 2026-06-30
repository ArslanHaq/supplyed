import type { AppState, SetAppState, SetTweaks, Tweaks } from "@/types/supplyed";
import { brandPalettes, deriveBrandTheme } from "@/lib/theme";

import { Btn, Icon } from "../atoms";

export function TweaksPanel({
  state,
  setState,
  tweaks,
  setTweaks,
}: {
  state: AppState;
  setState: SetAppState;
  tweaks: Tweaks;
  setTweaks: SetTweaks;
}) {
  const safeAccent = deriveBrandTheme(tweaks.accent).accent;
  const selectedPreset = brandPalettes.some((palette) => palette.accent.toLowerCase() === safeAccent.toLowerCase());

  if (!state.tweaksOpen) {
    return (
      <button
        className="fixed bottom-5 right-5 z-[70] inline-flex items-center gap-2 rounded-full border border-border bg-white px-3.5 py-2.5 text-ink shadow-panel"
        onClick={() => setState((current) => ({ ...current, tweaksOpen: true }))}
        type="button"
      >
        <Icon name="palette" size={16} />
        <span className="text-sm font-semibold">Theme</span>
        <span className="h-4 w-4 rounded-full border border-border" style={{ background: safeAccent }} />
      </button>
    );
  }

  return (
    <div className="tweaks-panel">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-serif text-lg">Theme</div>
        <Btn variant="ghost" size="sm" icon="x" onClick={() => setState((current) => ({ ...current, tweaksOpen: false }))} />
      </div>

      <div className="flex items-center gap-2.5">
        {brandPalettes.map((palette) => {
          const selected = safeAccent.toLowerCase() === palette.accent.toLowerCase();

          return (
            <button
              key={palette.accent}
              aria-label={palette.name}
              aria-pressed={selected}
              className="h-6 w-6 rounded-full border border-white transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2"
              onClick={() => setTweaks((current) => ({ ...current, accent: palette.accent }))}
              style={{
                background: palette.accent,
                boxShadow: selected ? "0 0 0 2px #fff, 0 0 0 4px var(--ink)" : "0 0 0 1px rgba(15, 23, 42, 0.12)",
              }}
              title={palette.name}
              type="button"
            />
          );
        })}
        <label
          aria-label="Custom accent color"
          className="relative h-6 w-6 cursor-pointer rounded-full border border-white transition hover:scale-105 focus-within:ring-2 focus-within:ring-ink focus-within:ring-offset-2"
          style={{
            background: "conic-gradient(from 180deg, #008CC4, #16A34A, #7C3AED, #E11D48, #D97706, #008CC4)",
            boxShadow: selectedPreset ? "0 0 0 1px rgba(15, 23, 42, 0.12)" : "0 0 0 2px #fff, 0 0 0 4px var(--ink)",
          }}
          title="Custom color"
        >
          <input
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={(event) => setTweaks((current) => ({ ...current, accent: event.target.value }))}
            type="color"
            value={safeAccent}
          />
        </label>
      </div>
    </div>
  );
}
