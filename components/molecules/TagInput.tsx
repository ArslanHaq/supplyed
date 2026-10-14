"use client";

import { useId, useState } from "react";

import { Icon } from "../atoms";

type TagInputProps = {
  id?: string;
  itemMaxLength?: number;
  maxItems?: number;
  onChange: (value: string[]) => void;
  placeholder?: string;
  value: string[];
};

export function TagInput({ id, itemMaxLength = 100, maxItems = 50, onChange, placeholder = "Type a skill and press Enter", value }: TagInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [draft, setDraft] = useState("");

  function addDraft() {
    const skill = draft.trim().replace(/,$/, "").trim();
    if (!skill || value.length >= maxItems || value.some((item) => item.toLowerCase() === skill.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, skill]);
    setDraft("");
  }

  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10">
      <div className="flex min-h-9 flex-wrap items-center gap-2">
        {value.map((skill) => (
          <span key={skill} className="inline-flex items-center gap-1 rounded-full bg-brand-tint px-2.5 py-1 text-xs font-semibold text-brand">
            {skill}
            <button
              aria-label={`Remove ${skill}`}
              className="cursor-pointer rounded-full p-0.5 hover:bg-white"
              onClick={() => onChange(value.filter((item) => item !== skill))}
              type="button"
            >
              <Icon name="x" size={12} />
            </button>
          </span>
        ))}
        <input
          id={inputId}
          className="min-w-[180px] flex-1 border-0 bg-transparent py-1 text-sm outline-none"
          disabled={value.length >= maxItems}
          maxLength={itemMaxLength}
          onBlur={addDraft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addDraft();
            } else if (event.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          placeholder={value.length ? undefined : placeholder}
          value={draft}
        />
      </div>
    </div>
  );
}
