"use client";

import DOMPurify from "dompurify";
import { useMemo, useSyncExternalStore } from "react";

import { cn } from "@/lib/cn";
import { hasRichTextMarkup, richTextToPlainText } from "@/features/applications/rich-text";

const allowedFontSizes = new Set(["12px", "14px", "16px", "18px", "20px", "24px"]);
const allowedFonts = new Set(["Arial", "Georgia", "Times New Roman"]);
const allowedColors = new Set(["#17211c", "#227557", "#315ca8", "#7a4a9e", "#a1483f"]);

function subscribeToBrowser() {
  return () => undefined;
}

function safeLink(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function sanitizeProposal(value: string) {
  const clean = DOMPurify.sanitize(value, {
    ALLOWED_ATTR: ["href", "style"],
    ALLOWED_TAGS: ["a", "b", "br", "em", "i", "li", "ol", "p", "span", "strong", "u", "ul"],
  });
  const template = document.createElement("template");
  template.innerHTML = clean;

  template.content.querySelectorAll<HTMLElement>("[style]").forEach((element) => {
    const nextStyles: string[] = [];
    const size = element.style.fontSize;
    const family = element.style.fontFamily.replace(/^['"]|['"]$/g, "");
    const color = element.style.color;

    if (allowedFontSizes.has(size)) nextStyles.push(`font-size: ${size}`);
    if (allowedFonts.has(family)) nextStyles.push(`font-family: ${family}`);

    const colorProbe = document.createElement("span");
    colorProbe.style.color = color;
    document.body.appendChild(colorProbe);
    const normalizedColor = getComputedStyle(colorProbe).color;
    colorProbe.remove();

    const allowedColor = Array.from(allowedColors).find((candidate) => {
      const probe = document.createElement("span");
      probe.style.color = candidate;
      document.body.appendChild(probe);
      const normalized = getComputedStyle(probe).color;
      probe.remove();
      return normalized === normalizedColor;
    });
    if (allowedColor) nextStyles.push(`color: ${allowedColor}`);

    if (nextStyles.length) element.setAttribute("style", nextStyles.join("; "));
    else element.removeAttribute("style");
  });

  template.content.querySelectorAll<HTMLAnchorElement>("a").forEach((link) => {
    if (!safeLink(link.href)) {
      link.replaceWith(document.createTextNode(link.textContent ?? ""));
      return;
    }
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  });

  return template.innerHTML;
}

export function ProposalContent({
  className,
  preview = false,
  value,
}: {
  className?: string;
  preview?: boolean;
  value: string;
}) {
  const plainText = useMemo(() => richTextToPlainText(value), [value]);
  const rich = hasRichTextMarkup(value);
  const browserReady = useSyncExternalStore(subscribeToBrowser, () => true, () => false);
  const safeHtml = useMemo(
    () => browserReady && rich ? sanitizeProposal(value) : null,
    [browserReady, rich, value],
  );

  if (!plainText) return null;

  if (preview || !rich || safeHtml === null) {
    return <p className={cn("whitespace-pre-wrap text-sm leading-6 text-muted", className)}>{plainText}</p>;
  }

  return (
    <div
      className={cn("proposal-content text-sm leading-7 text-muted", className)}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
