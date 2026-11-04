import type { ProfileDocument } from "@/features/profile-documents/types";
import { Icon } from "../atoms";

export function ProfileDocumentsSection({ documents, title }: { documents: ProfileDocument[]; title: string }) {
  if (!documents.length) return null;

  return (
    <section className="card mt-6 overflow-hidden">
      <div className="border-b border-border bg-surface-subtle px-5 py-5 sm:px-7">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-tint text-brand"><Icon name="award" size={19} /></div>
          <div><h2 className="font-heading text-lg font-semibold text-ink">{title}</h2><p className="mt-0.5 text-xs text-muted">Documents shared on this profile</p></div>
        </div>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7">
        {documents.map((document) => (
          <article className="overflow-hidden rounded-xl border border-border bg-surface" key={document.id}>
            {document.fileUrl && document.contentType?.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={document.title} className="h-40 w-full object-cover" src={document.fileUrl} />
            ) : null}
            <div className="p-4">
              <h3 className="font-semibold text-ink">{document.title}</h3>
              {document.issueDate ? <p className="mt-1 text-xs text-muted">Issued {formatIssueDate(document.issueDate)}</p> : null}
              {document.description ? <p className="mt-2 text-sm leading-6 text-slate">{document.description}</p> : null}
              {document.fileUrl ? <a className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline" href={document.fileUrl} rel="noreferrer" target="_blank"><Icon name="file" size={15} />View document</a> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function formatIssueDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}
