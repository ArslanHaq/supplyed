import { Btn } from "../atoms";

type Props = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  busy?: boolean;
  onPage: (page: number) => void;
  onLimit: (limit: number) => void;
};

export function ListPagination({ page, limit, total, totalPages, busy, onPage, onLimit }: Props) {
  const first = total ? Math.min((page - 1) * limit + 1, total) : 0;
  return <nav aria-label="List pagination" className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
    <p className="text-muted" aria-live="polite">{first}–{Math.min(page * limit, total)} of {total}</p>
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-muted">Per page<select className="rounded-lg border border-border bg-surface px-2 py-2 text-ink" disabled={busy} value={limit} onChange={event => onLimit(Number(event.target.value))}>{[10, 20, 50].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <Btn size="sm" variant="secondary" disabled={busy || page <= 1} onClick={() => onPage(page - 1)}>Previous</Btn>
      <span>Page {page} of {Math.max(1, totalPages)}</span>
      <Btn size="sm" variant="secondary" disabled={busy || page >= totalPages} onClick={() => onPage(page + 1)}>Next</Btn>
    </div>
  </nav>;
}
