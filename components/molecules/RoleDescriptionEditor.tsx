"use client";

import { useEffect, useRef } from "react";
import type QuillType from "quill";

import "quill/dist/quill.snow.css";

const allowedFormats = ["bold", "italic", "underline", "size", "list"];
const fontSizes = ["12px", "14px", "16px", "18px", "20px", "24px", "32px"];

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
  if (/<(?:p|div|br|strong|b|em|i|u|ul|ol|li|span)\b/i.test(value)) return value;

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

function isEmptyEditor(quill: QuillType) {
  return quill.getText().trim().length === 0;
}

function normalizedEditorHtml(quill: QuillType) {
  return quill.root.innerHTML
    .replace(/<ol>/gi, "<ul>")
    .replace(/<\/ol>/gi, "</ul>")
    .replace(/<li\s+data-list="bullet">/gi, "<li>")
    .replace(/<span\s+class="ql-ui"[^>]*><\/span>/gi, "");
}

export function RoleDescriptionEditor({
  invalid = false,
  onChange,
  value,
}: {
  invalid?: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<QuillType | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const lastEmittedValueRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    let active = true;
    let cleanupEditor: (() => void) | undefined;
    const editorElement = editorRef.current;
    const toolbarElement = toolbarRef.current;

    void import("quill").then(({ default: Quill }) => {
      if (!active || !editorElement || !toolbarElement || quillRef.current) return;

      const SizeStyle = Quill.import("attributors/style/size") as { whitelist: string[] };
      SizeStyle.whitelist = fontSizes;
      Quill.register(SizeStyle as never, true);

      const quill = new Quill(editorElement, {
        formats: allowedFormats,
        modules: {
          toolbar: toolbarElement,
        },
        placeholder: "Describe the class, cover expectations, timetable notes, support needs, and arrival instructions.",
        theme: "snow",
      });

      quill.root.setAttribute("aria-label", "Role description");
      quill.root.style.fontSize = "16px";
      quill.clipboard.dangerouslyPasteHTML(legacyDescriptionToHtml(valueRef.current), "silent");
      quillRef.current = quill;

      const handleTextChange = () => {
        const nextValue = isEmptyEditor(quill) ? "" : normalizedEditorHtml(quill);
        lastEmittedValueRef.current = nextValue;
        onChangeRef.current(nextValue);
      };

      quill.on("text-change", handleTextChange);
      cleanupEditor = () => quill.off("text-change", handleTextChange);
    });

    return () => {
      active = false;
      cleanupEditor?.();
      quillRef.current = null;
      editorElement?.replaceChildren();
    };
  }, []);

  useEffect(() => {
    const quill = quillRef.current;
    if (!quill || value === lastEmittedValueRef.current) return;

    const nextHtml = legacyDescriptionToHtml(value);
    if (quill.root.innerHTML === nextHtml || (isEmptyEditor(quill) && !nextHtml)) return;

    const selection = quill.getSelection();
    quill.clipboard.dangerouslyPasteHTML(nextHtml, "silent");
    if (selection) quill.setSelection(Math.min(selection.index, quill.getLength() - 1), selection.length, "silent");
  }, [value]);

  return (
    <div className={"role-description-editor overflow-hidden rounded-lg border bg-white focus-within:ring-2 focus-within:ring-brand/15 " + (invalid ? "border-danger" : "border-border-strong")}>
      <div ref={toolbarRef} aria-label="Role description formatting" className="border-0! border-b! border-border! bg-chalk">
        <span className="ql-formats">
          <button aria-label="Bold" className="ql-bold" type="button" />
          <button aria-label="Italic" className="ql-italic" type="button" />
          <button aria-label="Underline" className="ql-underline" type="button" />
        </span>
        <span className="ql-formats">
          <select aria-label="Font size" className="ql-size" defaultValue="">
            <option value="12px">12</option>
            <option value="14px">14</option>
            <option value="">16</option>
            <option value="18px">18</option>
            <option value="20px">20</option>
            <option value="24px">24</option>
            <option value="32px">32</option>
          </select>
        </span>
        <span className="ql-formats">
          <button aria-label="Bullet list" className="ql-list" type="button" value="bullet" />
        </span>
      </div>
      <div ref={editorRef} className="min-h-[220px] border-0! text-base" />
    </div>
  );
}
