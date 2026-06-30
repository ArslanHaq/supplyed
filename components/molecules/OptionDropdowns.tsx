"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

import { Icon } from "../atoms";

type SelectDropdownProps = {
  id?: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: boolean;
};

type MultiSelectDropdownProps = {
  value: string[];
  options: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  error?: boolean;
};

function optionSummary(value: string[], placeholder: string) {
  if (value.length === 0) return placeholder;
  if (value.length <= 2) return value.join(", ");
  return `${value.slice(0, 2).join(", ")} +${value.length - 2} more`;
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
          value ? "text-[var(--ink)]" : "text-[var(--muted)]",
          error ? "border-[var(--red)] bg-[var(--red-tint)]" : null,
        )}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="min-w-0 flex-1 truncate">{value || placeholder}</span>
        <Icon name="chevronDown" size={17} className={cn("shrink-0 text-[var(--muted)] transition", open ? "rotate-180" : null)} />
      </button>

      {open ? (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-lg border border-[var(--border)] bg-white shadow-[var(--shadow)]">
          <div className="max-h-64 overflow-auto p-1.5" role="listbox">
            {options.map((option) => {
              const selected = value === option;

              return (
                <button
                  key={option}
                  aria-selected={selected}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm text-[var(--slate)] transition hover:bg-[var(--chalk)]"
                  onClick={() => selectOption(option)}
                  role="option"
                  type="button"
                >
                  <span
                    className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[var(--border-2)] bg-white text-white data-[selected=true]:border-[var(--se)] data-[selected=true]:bg-[var(--se)]"
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

export function MultiSelectDropdown({ value, options, onChange, placeholder = "Select options", error }: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useDropdownDismiss(open, rootRef, () => setOpen(false));

  function toggleOption(option: string) {
    onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option]);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        aria-expanded={open}
        className={cn(
          "select flex min-h-[44px] cursor-pointer items-center justify-between gap-3 text-left",
          value.length === 0 ? "text-[var(--muted)]" : "text-[var(--ink)]",
          error ? "border-[var(--red)] bg-[var(--red-tint)]" : null,
        )}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="min-w-0 flex-1 truncate">{optionSummary(value, placeholder)}</span>
        <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-[var(--muted)]">
          {value.length > 0 ? `${value.length} selected` : null}
          <Icon name="chevronDown" size={17} className={cn("transition", open ? "rotate-180" : null)} />
        </span>
      </button>

      {open ? (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-lg border border-[var(--border)] bg-white shadow-[var(--shadow)]">
          <div className="max-h-64 overflow-auto p-1.5">
            {options.map((option) => {
              const selected = value.includes(option);

              return (
                <button
                  key={option}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm text-[var(--slate)] transition hover:bg-[var(--chalk)]"
                  onClick={() => toggleOption(option)}
                  type="button"
                >
                  <span
                    className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[var(--border-2)] bg-white text-white data-[selected=true]:border-[var(--se)] data-[selected=true]:bg-[var(--se)]"
                    data-selected={selected}
                  >
                    {selected ? <Icon name="check" size={11} /> : null}
                  </span>
                  <span className="flex-1">{option}</span>
                </button>
              );
            })}
          </div>
          {value.length > 0 ? (
            <div className="border-t border-[var(--border)] p-1.5">
              <button
                className="w-full cursor-pointer rounded-md px-3 py-2 text-left text-xs font-semibold text-[var(--se)] transition hover:bg-[var(--se-tint)]"
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
