"use client";

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

  const candidate = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function ProposalEditor({
  id,
  invalid = false,
  maxLength,
  onChange,
  value,
}: {
  id: string;
  invalid?: boolean;
  maxLength: number;
  onChange: (value: string, textLength: number) => void;
  value: string;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<QuillType | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const invalidRef = useRef(invalid);
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
        placeholder: "Introduce yourself, highlight relevant experience, and explain why you are a strong fit for this role.",
        theme: "snow",
      });

      quill.root.id = id;
      quill.root.setAttribute("role", "textbox");
      quill.root.setAttribute("aria-label", "Application proposal");
      quill.root.setAttribute("aria-multiline", "true");
      quill.root.setAttribute("aria-required", "true");
      quill.root.setAttribute("aria-invalid", String(invalidRef.current));
      quill.root.style.fontSize = "16px";
      for (const [format, label] of [["font", "Font family"], ["size", "Font size"], ["color", "Text color"]]) {
        toolbarElement.querySelector(`.ql-${format} .ql-picker-label`)?.setAttribute("aria-label", label);
      }
      quill.clipboard.dangerouslyPasteHTML(proposalToHtml(valueRef.current), "silent");
      quillRef.current = quill;
      onChangeRef.current(valueRef.current, editorTextLength(quill));

      const handleTextChange = () => {
        const length = editorTextLength(quill);
        if (length > maxLength) {
          quill.deleteText(maxLength, length - maxLength, "silent");
          quill.setSelection(maxLength, 0, "silent");
        }

        const nextValue = editorHtml(quill);
        const nextLength = editorTextLength(quill);
        lastEmittedValueRef.current = nextValue;
        onChangeRef.current(nextValue, nextLength);
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
  }, [id, maxLength, openLinkEditor]);

  useEffect(() => {
    const quill = quillRef.current;
    if (!quill || value === lastEmittedValueRef.current) return;

    const nextHtml = proposalToHtml(value);
    if (quill.root.innerHTML === nextHtml || (editorTextLength(quill) === 0 && !nextHtml)) return;

    const selection = quill.getSelection();
    quill.clipboard.dangerouslyPasteHTML(nextHtml, "silent");
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
      <div ref={toolbarRef} aria-label="Proposal formatting" role="toolbar">
        <span aria-label="Font and size" className="ql-formats proposal-font-controls" role="group">
          <select aria-label="Font family" className="ql-font" defaultValue="" title="Font family">
            <option value="">SupplyEd Sans</option>
            <option value="Arial">Arial</option>
            <option value="Georgia">Georgia</option>
            <option value="Times New Roman">Times New Roman</option>
          </select>
          <select aria-label="Font size" className="ql-size" defaultValue="" title="Font size">
            <option value="12px">12</option>
            <option value="14px">14</option>
            <option value="">16</option>
            <option value="18px">18</option>
            <option value="20px">20</option>
            <option value="24px">24</option>
          </select>
        </span>
        <span aria-label="Text style" className="ql-formats" role="group">
          <button aria-label="Bold" className="ql-bold" title="Bold" type="button" />
          <button aria-label="Italic" className="ql-italic" title="Italic" type="button" />
          <button aria-label="Underline" className="ql-underline" title="Underline" type="button" />
        </span>
        <span aria-label="Lists" className="ql-formats" role="group">
          <button aria-label="Bullet list" className="ql-list" title="Bullet list" type="button" value="bullet" />
          <button aria-label="Numbered list" className="ql-list" title="Numbered list" type="button" value="ordered" />
        </span>
        <span aria-label="Color, links and formatting" className="ql-formats" role="group">
          <select aria-label="Text color" className="ql-color" defaultValue="" title="Text color">
            <option value="" />
            <option value="#17211c" />
            <option value="#227557" />
            <option value="#315ca8" />
            <option value="#7a4a9e" />
            <option value="#a1483f" />
          </select>
          <button aria-label="Add link" className="ql-link" title="Add link" type="button" />
          <button aria-label="Clear formatting" className="ql-clean" title="Clear formatting" type="button" />
        </span>
      </div>

      {linkEditor ? (
        <div className="proposal-link-panel" onKeyDownCapture={(event) => {
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
                className="input h-10"
                onChange={(event) => {
                  setLinkEditor((current) => current ? { ...current, url: event.target.value } : current);
                  if (linkError) setLinkError(undefined);
                }}
                onKeyDownCapture={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyLink();
                  }
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
          {linkError ? <p className="mt-2 text-xs text-danger" role="alert">{linkError}</p> : null}
        </div>
      ) : null}

      <div ref={editorRef} className="proposal-editor-surface" />
    </div>
  );
}
