"use client";

import { useId, type ComponentProps } from "react";
import { ProposalEditor } from "./ProposalEditor";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatLegacyInline(value: string) {
  return escapeHtml(value).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function legacyDescriptionToHtml(value: string) {
  if (!value.trim()) return "";
  if (/<(?:p|div|br|strong|b|em|i|u|ul|ol|li|span|a)\b/i.test(value)) return value;

  const blocks: string[] = [];
  let listItems: string[] = [];

  function flushList() {
    if (listItems.length === 0) return;
    blocks.push("<ul>" + listItems.map((item) => "<li>" + formatLegacyInline(item) + "</li>").join("") + "</ul>");
    listItems = [];
  }

  value.replace(/\r/g, "").split("\n").forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line) {
      flushList();
      return;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      listItems.push(bullet[1]);
      return;
    }

    flushList();
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    blocks.push("<p>" + (heading ? "<strong>" + formatLegacyInline(heading[1]) + "</strong>" : formatLegacyInline(line)) + "</p>");
  });

  flushList();
  return blocks.join("");
}

/** Role descriptions share the cover-letter editor and its live dropdown collections. */
export function RoleDescriptionEditor({ id, value, onChange, ...props }: Omit<ComponentProps<typeof ProposalEditor>, "id" | "maxLength" | "onChange" | "label" | "placeholder"> & {
  id?: string;
  onChange: (value: string) => void;
}) {
  const generatedId = useId();
  const editorValue = legacyDescriptionToHtml(value);
  return <ProposalEditor
    {...props}
    id={id ?? generatedId}
    label="Role description"
    placeholder="Describe the class, cover expectations, timetable notes, support needs, and arrival instructions."
    maxLength={10000}
    value={editorValue}
    onChange={next => {
      // Initial parsing must not make an untouched saved job look edited.
      if (next !== editorValue) onChange(next);
    }}
  />;
}
