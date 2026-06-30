import { Icon } from "./Icon";

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      className="flex cursor-pointer items-center gap-2 border-0 bg-transparent text-left text-sm text-slate"
      onClick={() => onChange?.(!checked)}
      type="button"
    >
      <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-border-strong bg-white text-white data-[checked=true]:border-brand data-[checked=true]:bg-brand" data-checked={checked}>
        {checked ? <Icon name="check" size={11} /> : null}
      </span>
      {label}
    </button>
  );
}
