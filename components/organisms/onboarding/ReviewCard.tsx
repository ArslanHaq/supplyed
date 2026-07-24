import { cn } from "@/lib/cn";

import { Icon } from "../../atoms";
import type { ReviewGroup, UploadedFile } from "./types";
import { formatFileSize } from "./utils";

export function ReviewBadgeList({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-muted">Not selected</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className="rounded-full bg-brand-tint px-2.5 py-1 text-xs font-semibold text-brand">
          {item}
        </span>
      ))}
    </div>
  );
}

export function FileSummary({ file }: { file: UploadedFile | null }) {
  if (!file) return <span className="text-muted">Not uploaded</span>;

  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-ink">
      <Icon name={file.type.startsWith("image/") ? "image" : "file"} size={13} className="text-brand" />
      <span className="min-w-0 truncate">{file.name}</span>
      <span className="shrink-0 text-muted">{formatFileSize(file.size)}</span>
    </span>
  );
}

export function ReviewCard({
  featured = false,
  group,
  onEdit,
}: {
  featured?: boolean;
  group: ReviewGroup;
  onEdit: () => void;
}) {
  return (
    <section className={cn("min-w-0 rounded-xl border border-border bg-white", featured ? "p-5" : "p-4")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand">
            <Icon name={group.icon} size={19} />
          </div>
          <div className="min-w-0">
            <h3 className="font-serif text-xl leading-tight">{group.title}</h3>
            <p className="mt-1 text-sm leading-5 text-muted">{group.description}</p>
          </div>
        </div>
        <button
          className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-brand transition hover:bg-brand-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          onClick={onEdit}
          type="button"
        >
          Edit
        </button>
      </div>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {group.lines.map((line) => (
          <div
            key={line.label}
            className={cn("min-w-0 rounded-lg bg-chalk px-3.5 py-3", line.wide && featured ? "sm:col-span-2" : null)}
          >
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[1px] text-muted">{line.label}</div>
            <div className="min-w-0 break-words text-sm leading-6 text-ink">{line.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
