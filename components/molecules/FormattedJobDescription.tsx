import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type DescriptionBlock =
  | { text: string; type: "heading" }
  | { items: string[]; type: "list" }
  | { text: string; type: "paragraph" };

function flushParagraph(blocks: DescriptionBlock[], lines: string[]) {
  const text = lines.join(" ").trim();
  if (text) blocks.push({ text, type: "paragraph" });
  lines.length = 0;
}

function flushList(blocks: DescriptionBlock[], items: string[]) {
  if (items.length > 0) blocks.push({ items: [...items], type: "list" });
  items.length = 0;
}

function parseDescription(description: string) {
  const blocks: DescriptionBlock[] = [];
  const paragraphLines: string[] = [];
  const listItems: string[] = [];

  description
    .replace(/\r/g, "")
    .split("\n")
    .forEach((rawLine) => {
      const line = rawLine.trim();

      if (!line) {
        flushParagraph(blocks, paragraphLines);
        flushList(blocks, listItems);
        return;
      }

      const heading = line.match(/^#{1,3}\s+(.+)$/);
      if (heading) {
        flushParagraph(blocks, paragraphLines);
        flushList(blocks, listItems);
        blocks.push({ text: heading[1].trim(), type: "heading" });
        return;
      }

      const bullet = line.match(/^[-*]\s+(.+)$/);
      if (bullet) {
        flushParagraph(blocks, paragraphLines);
        listItems.push(bullet[1].trim());
        return;
      }

      flushList(blocks, listItems);
      paragraphLines.push(line);
    });

  flushParagraph(blocks, paragraphLines);
  flushList(blocks, listItems);

  return blocks;
}

function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return parts.map<ReactNode>((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${keyPrefix}-strong-${index}`} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }

    return part;
  });
}

export function FormattedJobDescription({
  className,
  description,
  emptyText = "Role details will appear here.",
}: {
  className?: string;
  description: string;
  emptyText?: string;
}) {
  const blocks = parseDescription(description.trim());

  if (blocks.length === 0) {
    return <p className={cn("text-sm leading-6 text-muted", className)}>{emptyText}</p>;
  }

  return (
    <div className={cn("space-y-3 text-sm leading-6 text-muted", className)}>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <h3 key={`${block.type}-${index}`} className="font-serif text-lg leading-tight text-ink">
              {renderInline(block.text, `heading-${index}`)}
            </h3>
          );
        }

        if (block.type === "list") {
          return (
            <ul key={`${block.type}-${index}`} className="list-disc space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={`${block.type}-${index}-${itemIndex}`}>{renderInline(item, `item-${index}-${itemIndex}`)}</li>
              ))}
            </ul>
          );
        }

        return <p key={`${block.type}-${index}`}>{renderInline(block.text, `paragraph-${index}`)}</p>;
      })}
    </div>
  );
}
