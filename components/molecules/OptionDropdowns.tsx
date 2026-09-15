"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

import { Icon } from "../atoms";

type SelectDropdownProps = {
  id?: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: boolean;
};

type MultiSelectDropdownProps = {
  id?: string;
  value: string[];
  options: Array<string | MultiSelectOption>;
  onChange: (value: string[]) => void;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
};

type MultiSelectOption = {
  description?: string | null;
  label: string;
  value: string;
};

function normalizeMultiSelectOption(option: string | MultiSelectOption): MultiSelectOption {
  return typeof option === "string" ? { label: option, value: option } : option;
}

function optionSummary(value: string[], options: MultiSelectOption[], placeholder: string) {
  if (value.length === 0) return placeholder;
  const labels = value.map((selectedValue) => options.find((option) => option.value === selectedValue)?.label ?? selectedValue);
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.slice(0, 2).join(", ")} +${labels.length - 2} more`;
}

export function SelectDropdown({ id, value, options, onChange, placeholder = "Select an option", error }: SelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useDropdownDismiss(open, rootRef, () => setOpen(false));

  function selectOption(option: string) {
    onChange(option);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        id={id}
        className={cn(
          "select flex min-h-[44px] cursor-pointer items-center justify-between gap-3 text-left",
          value ? "text-ink" : "text-muted",
          error ? "border-danger bg-danger-tint" : null,
        )}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="min-w-0 flex-1 truncate">{value || placeholder}</span>
        <Icon name="chevronDown" size={17} className={cn("shrink-0 text-muted transition", open ? "rotate-180" : null)} />
      </button>

      {open ? (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-lg border border-border bg-white shadow-card">
          <div className="max-h-64 overflow-auto p-1.5" role="listbox">
            {options.map((option) => {
              const selected = value === option;

              return (
                <button
                  key={option}
                  aria-selected={selected}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm text-slate transition hover:bg-chalk"
                  onClick={() => selectOption(option)}
                  role="option"
                  type="button"
                >
                  <span
                    className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border-strong bg-white text-white data-[selected=true]:border-brand data-[selected=true]:bg-brand"
                    data-selected={selected}
                  >
                    {selected ? <Icon name="check" size={11} /> : null}
                  </span>
                  <span className="flex-1">{option}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function useDropdownDismiss(open: boolean, rootRef: React.RefObject<HTMLDivElement | null>, onDismiss: () => void) {
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        onDismiss();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, rootRef, onDismiss]);
}

export function MultiSelectDropdown({ id, value, options, onChange, placeholder = "Select options", error, disabled = false }: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const normalizedOptions = options.map(normalizeMultiSelectOption);

  useDropdownDismiss(open, rootRef, () => setOpen(false));

  function toggleOption(option: string) {
    onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option]);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        id={id}
        className={cn(
          "select flex min-h-[44px] cursor-pointer items-center justify-between gap-3 text-left",
          value.length === 0 ? "text-muted" : "text-ink",
          error ? "border-danger bg-danger-tint" : null,
          disabled ? "cursor-not-allowed opacity-60" : null,
        )}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="min-w-0 flex-1 truncate">{optionSummary(value, normalizedOptions, placeholder)}</span>
        <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-muted">
          {value.length > 0 ? `${value.length} selected` : null}
          <Icon name="chevronDown" size={17} className={cn("transition", open ? "rotate-180" : null)} />
        </span>
      </button>

      {open ? (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-lg border border-border bg-white shadow-card">
          <div className="max-h-64 overflow-auto p-1.5" role="listbox" aria-multiselectable="true">
            {normalizedOptions.map((option) => {
              const selected = value.includes(option.value);

              return (
                <button
                  key={option.value}
                  aria-selected={selected}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm text-slate transition hover:bg-chalk"
                  onClick={() => toggleOption(option.value)}
                  role="option"
                  type="button"
                >
                  <span
                    className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border-strong bg-white text-white data-[selected=true]:border-brand data-[selected=true]:bg-brand"
                    data-selected={selected}
                  >
                    {selected ? <Icon name="check" size={11} /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block">{option.label}</span>
                    {option.description ? <span className="mt-0.5 block text-xs leading-5 text-muted">{option.description}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
          {value.length > 0 ? (
            <div className="border-t border-border p-1.5">
              <button
                className="w-full cursor-pointer rounded-md px-3 py-2 text-left text-xs font-semibold text-brand transition hover:bg-brand-tint"
                onClick={() => onChange([])}
                type="button"
              >
                Clear selection
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
