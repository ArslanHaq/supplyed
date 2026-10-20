"use client";
import { DynamicSelect } from "./DynamicDropdown";

import { useCallback, useEffect, useRef, useState } from "react";
import type QuillType from "quill";

import "quill/dist/quill.snow.css";

const allowedFormats = ["bold", "italic", "underline", "list", "font", "size", "color", "link"];
const fontSizes = ["12px", "14px", "16px", "18px", "20px", "24px"];
const fontFamilies = ["Arial", "Georgia", "Times New Roman"];

type LinkEditorState = {
  index: number;
  length: number;
  text: string;
  url: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function proposalToHtml(value: string) {
  if (!value.trim()) return "";
  if (/<(?:p|div|br|strong|b|em|i|u|ul|ol|li|span|a)\b/i.test(value)) return value;

  return value
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function editorTextLength(quill: QuillType) {
  return Math.max(0, quill.getLength() - 1);
}

function editorHtml(quill: QuillType) {
  return editorTextLength(quill) === 0 ? "" : quill.getSemanticHTML().trim();
}

function normalizeLink(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const candidate = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? `mailto:${trimmed}` : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    if (url.protocol === "mailto:") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url.pathname) ? url.toString() : null;
    return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname) && !/\s/.test(trimmed) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function ProposalEditor({
  id,
  invalid = false,
  label = "Application proposal",
  placeholder = "Introduce yourself, highlight relevant experience, and explain why you are a strong fit for this role.",
  "aria-describedby": describedBy,
  "aria-labelledby": labelledBy,
  maxLength,
  onChange,
  value,
}: {
  id: string;
  invalid?: boolean;
  label?: string;
  placeholder?: string;
  "aria-describedby"?: string;
  "aria-labelledby"?: string;
  maxLength: number;
  onChange: (value: string, textLength: number) => void;
  value: string;
}) {
  const [formats, setFormats] = useState<Record<string, string>>({});
  function applyFormat(format: string, value: string) {
    const quill = quillRef.current;
    if (!quill) return;
    quill.focus();
    quill.format(format, value || false, "user");
    setFormats(current => ({ ...current, [format]: value }));
  }
  const editorRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<QuillType | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const invalidRef = useRef(invalid);
  const ariaRef = useRef({ describedBy, labelledBy });
  const lastEmittedValueRef = useRef<string | undefined>(undefined);
  const [linkEditor, setLinkEditor] = useState<LinkEditorState | null>(null);
  const [linkError, setLinkError] = useState<string>();

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    invalidRef.current = invalid;
    quillRef.current?.root.setAttribute("aria-invalid", String(invalid));
  }, [invalid]);

  useEffect(() => {
    ariaRef.current = { describedBy, labelledBy };
    const root = quillRef.current?.root;
    for (const [attribute, value] of [["aria-describedby", describedBy], ["aria-labelledby", labelledBy]] as const) {
      if (value) root?.setAttribute(attribute, value);
      else root?.removeAttribute(attribute);
    }
  }, [describedBy, labelledBy]);

  const openLinkEditor = useCallback(() => {
    const quill = quillRef.current;
    if (!quill) return;

    const range = quill.getSelection(true) ?? { index: Math.max(0, quill.getLength() - 1), length: 0 };
    const format = quill.getFormat(range);
    setLinkError(undefined);
    setLinkEditor({
      index: range.index,
      length: range.length,
      text: range.length > 0 ? quill.getText(range.index, range.length) : "",
      url: typeof format.link === "string" ? format.link : "",
    });
  }, []);

  useEffect(() => {
    let active = true;
    let cleanupEditor: (() => void) | undefined;
    const editorElement = editorRef.current;
    const toolbarElement = toolbarRef.current;

    void import("quill").then(({ default: Quill }) => {
      if (!active || !editorElement || !toolbarElement || quillRef.current) return;

      const SizeStyle = Quill.import("attributors/style/size") as { whitelist: string[] };
      const FontStyle = Quill.import("attributors/style/font") as { whitelist: string[] };
      SizeStyle.whitelist = fontSizes;
      FontStyle.whitelist = fontFamilies;
      Quill.register(SizeStyle as never, true);
      Quill.register(FontStyle as never, true);

      const quill = new Quill(editorElement, {
        formats: allowedFormats,
        modules: {
          toolbar: {
            container: toolbarElement,
            handlers: {
              link: openLinkEditor,
            },
          },
        },
        placeholder,
        theme: "snow",
      });

      quill.root.id = id;
      quill.root.setAttribute("role", "textbox");
      quill.root.setAttribute("aria-label", label);
      if (ariaRef.current.describedBy) quill.root.setAttribute("aria-describedby", ariaRef.current.describedBy);
      if (ariaRef.current.labelledBy) quill.root.setAttribute("aria-labelledby", ariaRef.current.labelledBy);
      quill.root.setAttribute("aria-multiline", "true");
      quill.root.setAttribute("aria-required", "true");
      quill.root.setAttribute("aria-invalid", String(invalidRef.current));
      quill.root.style.fontSize = "16px";
      for (const [format, label] of [["font", "Font family"], ["size", "Font size"], ["color", "Text color"]]) {
        toolbarElement.querySelector(`.ql-${format} .ql-picker-label`)?.setAttribute("aria-label", label);
      }
      // Loading content must not move focus away from another form field.
      quill.setContents(quill.clipboard.convert({ html: proposalToHtml(valueRef.current), text: "" }), "silent");
      quillRef.current = quill;
      onChangeRef.current(valueRef.current, editorTextLength(quill));

      const handleTextChange = () => {
        const nextValue = editorHtml(quill);
        const nextLength = editorTextLength(quill);
        lastEmittedValueRef.current = nextValue;
        onChangeRef.current(nextValue, nextLength);
      };

      const syncFormats = (range: { index: number; length: number } | null) => {
        // A null range means focus left the editor. getFormat() without a range
        // calls getSelection(true), which would immediately steal it back.
        if (!range) return;
        const format = quill.getFormat(range);
        setFormats(Object.fromEntries(["font", "size", "color"].map(name => [name, typeof format[name] === "string" ? format[name] as string : ""])));
      };
      quill.on("selection-change", syncFormats);
      quill.on("text-change", handleTextChange);
      cleanupEditor = () => { quill.off("text-change", handleTextChange); quill.off("selection-change", syncFormats); };
    });

    return () => {
      active = false;
      cleanupEditor?.();
      quillRef.current = null;
      editorElement?.replaceChildren();
    };
  }, [id, label, placeholder, maxLength, openLinkEditor]);

  useEffect(() => {
    const quill = quillRef.current;
    if (!quill || value === lastEmittedValueRef.current) return;

    const nextHtml = proposalToHtml(value);
    if (quill.root.innerHTML === nextHtml || (editorTextLength(quill) === 0 && !nextHtml)) return;

    const selection = quill.hasFocus() ? quill.getSelection() : null;
    quill.setContents(quill.clipboard.convert({ html: nextHtml, text: "" }), "silent");
    if (selection) quill.setSelection(Math.min(selection.index, quill.getLength() - 1), selection.length, "silent");
  }, [value]);

  function closeLinkEditor() {
    setLinkEditor(null);
    setLinkError(undefined);
    quillRef.current?.focus();
  }

  function applyLink() {
    const quill = quillRef.current;
    if (!quill || !linkEditor) return;

    const url = normalizeLink(linkEditor.url);
    if (!url) {
      setLinkError("Enter a valid website or email link.");
      return;
    }

    if (linkEditor.length > 0) {
      quill.formatText(linkEditor.index, linkEditor.length, "link", url, "user");
    } else {
      const text = linkEditor.text.trim() || linkEditor.url.trim();
      if (!text) {
        setLinkError("Add link text or a URL.");
        return;
      }
      quill.insertText(linkEditor.index, text, { link: url }, "user");
      quill.setSelection(linkEditor.index + text.length, 0, "silent");
    }

    closeLinkEditor();
  }

  function removeLink() {
    const quill = quillRef.current;
    if (!quill || !linkEditor) return;
    if (linkEditor.length > 0) quill.formatText(linkEditor.index, linkEditor.length, "link", false, "user");
    closeLinkEditor();
  }

  return (
    <div className="proposal-editor" data-invalid={invalid}>
      <div className="editor-appearance-controls" aria-label="Text appearance">
        <DynamicSelect aria-label="Font family" collection="proposalFontFamily" emptyLabel="SupplyEd Sans" value={formats.font ?? ""} onChange={value => applyFormat("font", value)} />
        <DynamicSelect aria-label="Font size" collection="proposalFontSize" emptyLabel="16" value={formats.size ?? ""} onChange={value => applyFormat("size", value)} />
        <DynamicSelect aria-label="Text color" collection="proposalTextColor" emptyLabel="Default" value={formats.color ?? ""} onChange={value => applyFormat("color", value)} />
      </div>
      <div ref={toolbarRef} aria-label={`${label} formatting`} role="toolbar">
        <span aria-label="Text style" className="ql-formats" role="group">
          <button aria-label="Bold" className="ql-bold" title="Bold" type="button" />
          <button aria-label="Italic" className="ql-italic" title="Italic" type="button" />
          <button aria-label="Underline" className="ql-underline" title="Underline" type="button" />
        </span>
        <span aria-label="Lists" className="ql-formats" role="group">
          <button aria-label="Bullet list" className="ql-list" title="Bullet list" type="button" value="bullet" />
          <button aria-label="Numbered list" className="ql-list" title="Numbered list" type="button" value="ordered" />
        </span>
        <span aria-label="Links and formatting" className="ql-formats" role="group">
          <button aria-label="Add link" className="ql-link" title="Add link" type="button" />
          <button aria-label="Clear formatting" className="ql-clean" title="Clear formatting" type="button" />
        </span>
      </div>

      {linkEditor ? (
        <div className="proposal-link-panel" onKeyDownCapture={(event) => {
          if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
            event.preventDefault();
            event.stopPropagation();
            applyLink();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            closeLinkEditor();
          }
        }}>
          <h3 className="proposal-link-title">Add a link</h3>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto] sm:items-end">
            <label className="grid gap-1 text-xs font-semibold text-ink">
              Link text
              <input
                className="input h-10"
                disabled={linkEditor.length > 0}
                onChange={(event) => setLinkEditor((current) => current ? { ...current, text: event.target.value } : current)}
                placeholder="School website"
                value={linkEditor.text}
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-ink">
              Website or email address
              <input
                autoFocus
                aria-invalid={Boolean(linkError)}
                aria-describedby={linkError ? `${id}-link-error` : undefined}
                className="input h-10"
                onChange={(event) => {
                  setLinkEditor((current) => current ? { ...current, url: event.target.value } : current);
                  if (linkError) setLinkError(normalizeLink(event.target.value) ? undefined : "Enter a valid website or email link.");
                }}
                placeholder="https://example.com"
                value={linkEditor.url}
              />
            </label>
            <div className="flex gap-2">
              {linkEditor.length > 0 && linkEditor.url ? <button className="editor-link-action text-danger" onClick={removeLink} type="button">Remove</button> : null}
              <button className="editor-link-action" onClick={closeLinkEditor} type="button">Cancel</button>
              <button className="editor-link-action editor-link-action-primary" onClick={applyLink} type="button">Apply</button>
            </div>
          </div>
          {linkError ? <p className="mt-2 text-xs text-danger" id={`${id}-link-error`} role="alert">{linkError}</p> : null}
        </div>
      ) : null}

      <div ref={editorRef} className="proposal-editor-surface" />
    </div>
  );
}
