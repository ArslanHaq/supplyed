export function Toggle({ on, onChange, label = "Toggle setting" }: { on: boolean; onChange?: (on: boolean) => void; label?: string }) {
  return (
    <button
      aria-checked={on}
      aria-label={label}
      role="switch"
      className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full bg-border-strong transition before:absolute before:-inset-y-2.5 before:-inset-x-1 data-[on=true]:bg-brand-dark"
      data-on={on}
      onClick={() => onChange?.(!on)}
      type="button"
    >
      <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition data-[on=true]:translate-x-5" data-on={on} />
    </button>
  );
}
