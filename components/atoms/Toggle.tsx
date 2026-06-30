export function Toggle({ on, onChange }: { on: boolean; onChange?: (on: boolean) => void }) {
  return (
    <button
      aria-pressed={on}
      className="relative h-6 w-11 cursor-pointer rounded-full bg-[var(--border-2)] transition data-[on=true]:bg-[var(--se)]"
      data-on={on}
      onClick={() => onChange?.(!on)}
      type="button"
    >
      <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition data-[on=true]:translate-x-5" data-on={on} />
    </button>
  );
}
