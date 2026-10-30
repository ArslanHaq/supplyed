"use client";

import { Fragment, type AriaAttributes, type KeyboardEvent, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { Icon } from "../atoms";

export type SelectOption = { group?: string; keywords?: string; description?: string | null; label: string; value: string };
type DropdownProps = AriaAttributes & {
  id?: string;
  name?: string;
  className?: string;
  options: readonly (string | SelectOption)[];
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  required?: boolean;
  searchable?: boolean;
  maxSelections?: number;
};
type SelectDropdownProps = DropdownProps & { value: string; onChange: (value: string) => void };
type MultiSelectDropdownProps = DropdownProps & { value: string[]; onChange: (value: string[]) => void };

function normalizeOption(option: string | SelectOption): SelectOption {
  return typeof option === "string" ? { label: option, value: option } : option;
}

/** One control, menu and keyboard model for single, multiple and searchable selections. */
function OptionDropdown({
  id, name, className, value, options, onChange, placeholder, error,
  disabled = false, required, searchable = false, multiple = false, maxSelections, ...aria
}: DropdownProps & { value: string[]; onChange: (value: string[]) => void; placeholder: string; multiple?: boolean }) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const listId = `${controlId}-options`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [nativeInvalid, setNativeInvalid] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const clearRef = useRef<HTMLButtonElement>(null);
  const typeaheadRef = useRef({ text: "", time: 0 });
  const normalizedOptions = options.map(normalizeOption);
  const filteredOptions = normalizedOptions.filter((option) => `${option.label} ${option.keywords ?? ""}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const labels = value.map((item) => normalizedOptions.find((option) => option.value === item)?.label ?? item);
  const summary = labels.join(", ");
  const activeOptionId = filteredOptions[activeIndex] ? `${listId}-${activeIndex}` : undefined;
  const isOpen = open && !disabled;

  function close(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }
  function show(fromEnd = false) {
    setQuery("");
    const selectedIndex = normalizedOptions.findIndex((option) => value.includes(option.value));
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : fromEnd ? normalizedOptions.length - 1 : 0);
    setOpen(true);
  }
  function change(next: string[]) {
    setNativeInvalid(false);
    onChange(next);
  }
  function choose(option: SelectOption) {
    if (multiple && maxSelections && value.length >= maxSelections && !value.includes(option.value)) return;
    if (multiple) change(value.includes(option.value) ? value.filter((item) => item !== option.value) : [...value, option.value]);
    else { change([option.value]); close(true); }
  }

  useLayoutEffect(() => {
    if (!isOpen) return;
    const menu = menuRef.current;
    const trigger = triggerRef.current;
    if (!menu || !trigger) return;
    // Top-layer menus escape overflow without leaving a parent dialog's DOM/focus scope.
    menu.showPopover?.();
    function position() {
      if (!menu || !trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0;
      const top = viewport?.offsetTop ?? 0;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const gap = 6;
      const margin = 8;
      if (rect.bottom < top || rect.top > top + viewportHeight) {
        setOpen(false);
        return;
      }
      const below = top + viewportHeight - rect.bottom - gap - margin;
      const above = rect.top - top - gap - margin;
      const openAbove = below < 260 && above > below;
      const availableHeight = Math.max(0, openAbove ? above : below);
      const width = Math.min(rect.width, viewportWidth - margin * 2);
      menu.style.width = `${width}px`;
      menu.style.left = `${Math.max(left + margin, Math.min(rect.left, left + viewportWidth - width - margin))}px`;
      menu.style.maxHeight = `${Math.min(360, availableHeight)}px`;
      menu.style.top = `${openAbove ? Math.max(top + margin, rect.top - gap - menu.offsetHeight) : rect.bottom + gap}px`;
    }
    position();
    searchRef.current?.focus({ preventScroll: true });
    const observer = new ResizeObserver(position);
    observer.observe(trigger);
    observer.observe(menu);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    window.visualViewport?.addEventListener("scroll", position);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("scroll", position);
      if (menu.matches(":popover-open")) menu.hidePopover?.();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function dismissOutside(event: Event) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("focusin", dismissOutside);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("focusin", dismissOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && activeOptionId) document.getElementById(activeOptionId)?.scrollIntoView({ block: "nearest" });
  }, [activeOptionId, isOpen]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const inSearch = event.target === searchRef.current;
    const inClear = event.target === clearRef.current;
    if (isOpen && event.key === "Escape") {
      event.preventDefault(); event.stopPropagation(); close(true); return;
    }
    if (event.key === "Tab" && isOpen) {
      if (!event.shiftKey && !inClear && clearRef.current) {
        event.preventDefault(); clearRef.current.focus();
      } else if (event.shiftKey && inClear) {
        event.preventDefault(); (searchRef.current ?? triggerRef.current)?.focus();
      } else {
        // Restore the field's position in tab order before native Tab advances.
        triggerRef.current?.focus(); close();
      }
      return;
    }
    if (inClear) return;
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) && (!inSearch || !["Home", "End"].includes(event.key))) {
      event.preventDefault();
      if (!isOpen) { show(event.key === "ArrowUp" || event.key === "End"); return; }
      const last = filteredOptions.length - 1;
      setActiveIndex(event.key === "Home" ? 0 : event.key === "End" ? last : Math.max(0, Math.min(last, activeIndex + (event.key === "ArrowDown" ? 1 : -1))));
      return;
    }
    if (isOpen && (event.key === "Enter" || (event.key === " " && !inSearch))) {
      event.preventDefault();
      const option = filteredOptions[activeIndex];
      if (option) choose(option);
      return;
    }
    if (!inSearch && event.key.length === 1 && event.key !== " " && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = event.timeStamp;
      const previous = typeaheadRef.current;
      const text = now - previous.time < 700 ? previous.text + event.key : event.key;
      typeaheadRef.current = { text, time: now };
      if (!isOpen) show();
      if (searchable) { setQuery(text); setActiveIndex(0); }
      else {
        const index = normalizedOptions.findIndex((option) => option.label.toLocaleLowerCase().startsWith(text.toLocaleLowerCase()));
        if (index >= 0) setActiveIndex(index);
      }
    }
  }

  return (
    <div ref={rootRef} className="option-dropdown" onKeyDownCapture={handleKeyDown}>
      {name || required ? (
        <select
          className="option-native-control" aria-hidden="true" tabIndex={-1} name={name} required={required} disabled={disabled}
          multiple={multiple} value={multiple ? value : value[0] ?? ""}
          onChange={(event) => change(Array.from(event.target.selectedOptions, (option) => option.value))}
          onInvalid={(event) => { event.preventDefault(); setNativeInvalid(true); triggerRef.current?.focus(); }}
        >
          {!multiple ? <option value="">{placeholder}</option> : null}
          {normalizedOptions.filter((option) => multiple || option.value !== "").map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : null}
      <button
        {...aria} ref={triggerRef}
        aria-label={aria["aria-label"] ?? (aria["aria-labelledby"] || id ? undefined : placeholder)}
        aria-expanded={isOpen} aria-haspopup="listbox" aria-controls={isOpen ? listId : undefined}
        aria-activedescendant={isOpen && !searchable ? activeOptionId : undefined}
        aria-invalid={error || nativeInvalid || aria["aria-invalid"] || undefined}
        aria-required={required || aria["aria-required"] || undefined}
        aria-describedby={[aria["aria-describedby"], nativeInvalid ? `${controlId}-validation` : ""].filter(Boolean).join(" ") || undefined}
        role="combobox" id={controlId} className={cn("select option-trigger", className)}
        data-placeholder={value.length === 0 || (value[0] === "" && summary === placeholder) || undefined} disabled={disabled}
        onClick={() => isOpen ? close() : show()} type="button" title={summary || undefined}
      >
        <span className="option-summary">{summary || placeholder}</span>
        {multiple && value.length > 0 ? <span className="option-count" aria-label={`${value.length} selected`}>{value.length}</span> : null}
        <Icon name="chevronDown" size={16} className={cn("option-chevron", isOpen && "rotate-180")} />
      </button>
      {nativeInvalid ? <div className="option-validation" id={`${controlId}-validation`} role="alert">Please select {multiple ? "at least one option" : "an option"}.</div> : null}
      {isOpen ? (
        <div ref={menuRef} className="option-menu" popover="manual">
          {searchable ? (
            <div className="option-search">
              <Icon name="search" size={16} />
              <input
                ref={searchRef} aria-label={`Search ${placeholder.toLocaleLowerCase().replace(/^select /, "")}`}
                aria-autocomplete="list" aria-controls={listId} aria-expanded="true" aria-activedescendant={activeOptionId}
                autoComplete="off" placeholder="Search options…" role="combobox" value={query}
                onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
              />
            </div>
          ) : null}
          <div className="option-list" role="listbox" id={listId} aria-label={aria["aria-label"] ?? placeholder} aria-labelledby={aria["aria-labelledby"]} aria-multiselectable={multiple || undefined}>
            {filteredOptions.map((option, index) => {
              const selected = value.includes(option.value);
              return (
                <Fragment key={option.value}>
                {option.group && option.group !== filteredOptions[index - 1]?.group ? <div role="presentation" className="px-3 py-2 text-xs font-semibold text-muted">{option.group}</div> : null}
                <button
                  key={option.value} id={`${listId}-${index}`} aria-selected={selected} className="option-item"
                  data-active={activeIndex === index || undefined} onMouseDown={(event) => event.preventDefault()}
                  onClick={() => { setActiveIndex(index); choose(option); }} role="option" tabIndex={-1} type="button"
                >
                  <span className="option-indicator" data-multiple={multiple || undefined} aria-hidden="true">{selected ? <Icon name="check" size={12} /> : null}</span>
                  <span className="option-copy"><span>{option.label}</span>{option.description ? <span className="option-description">{option.description}</span> : null}</span>
                </button>
                </Fragment>
              );
            })}
            {filteredOptions.length === 0 ? <div className="option-empty" role="status">No options found</div> : null}
          </div>
          {multiple && value.length > 0 ? (
            <div className="option-footer">
              <button ref={clearRef} className="option-clear" onClick={() => { change([]); (searchRef.current ?? triggerRef.current)?.focus(); }} type="button">Clear selection</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function SelectDropdown({ value, onChange, placeholder = "Select an option", ...props }: SelectDropdownProps) {
  const hasEmptyOption = props.options.some((option) => normalizeOption(option).value === "");
  return <OptionDropdown {...props} value={value || hasEmptyOption ? [value] : []} onChange={(values) => onChange(values[0] ?? "")} placeholder={placeholder} />;
}

export function MultiSelectDropdown({ placeholder = "Select options", ...props }: MultiSelectDropdownProps) {
  return <OptionDropdown {...props} placeholder={placeholder} multiple />;
}
