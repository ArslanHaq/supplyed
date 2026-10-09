import { useMemo, useState } from "react";

import type { TeacherDirectoryFilters, TeacherDirectoryItem } from "@/features/teachers/types";
import { useTeacherDirectory } from "@/features/teachers/use-teachers";
import type { RouteProps } from "@/types/supplyed";

import { Avatar, Btn, Checkbox, Field, Icon, Stars, Tag, VerifyBadge } from "../atoms";
import { PageHead, SectionLoader } from "../molecules";

const PAGE_SIZE = 12;
const stageOptions = ["", "KS1", "KS2", "KS3", "KS4", "KS5"];

type DirectoryForm = {
  availableToday: boolean;
  city: string;
  dbsVerified: boolean;
  keyStage: string;
  maxDailyRate: string;
  maxHourlyRate: string;
  minExperience: string;
  minRating: string;
  qtsQualified: boolean;
  search: string;
  skill: string;
  subject: string;
};

const emptyFilters: DirectoryForm = {
  availableToday: false,
  city: "",
  dbsVerified: false,
  keyStage: "",
  maxDailyRate: "",
  maxHourlyRate: "",
  minExperience: "",
  minRating: "",
  qtsQualified: false,
  search: "",
  skill: "",
  subject: "",
};

export function FindTeachersPage({ ctx, go }: Pick<RouteProps, "ctx" | "go">) {
  const [draft, setDraft] = useState<DirectoryForm>(() => ({ ...emptyFilters, search: ctx.search ?? "" }));
  const [applied, setApplied] = useState<DirectoryForm>(() => ({ ...emptyFilters, search: ctx.search ?? "" }));
  const [page, setPage] = useState(1);
  const filters = useMemo<TeacherDirectoryFilters>(() => ({
    availableToday: applied.availableToday || undefined,
    city: applied.city || undefined,
    dbsVerified: applied.dbsVerified || undefined,
    keyStage: applied.keyStage || undefined,
    limit: PAGE_SIZE,
    maxDailyRate: optionalNumber(applied.maxDailyRate),
    maxHourlyRate: optionalNumber(applied.maxHourlyRate),
    minExperience: optionalNumber(applied.minExperience),
    minRating: optionalNumber(applied.minRating),
    page,
    qtsQualified: applied.qtsQualified || undefined,
    search: applied.search || undefined,
    skill: applied.skill || undefined,
    subject: applied.subject || undefined,
  }), [applied, page]);
  const teachersQuery = useTeacherDirectory(filters);
  const instructors = teachersQuery.data?.instructors ?? [];
  const pagination = teachersQuery.data?.pagination;
  const hasDraftFilters = Object.entries(draft).some(([, value]) => value === true || (typeof value === "string" && Boolean(value.trim())));

  function update<Key extends keyof DirectoryForm>(key: Key, value: DirectoryForm[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function applyFilters() {
    setApplied(trimFilters(draft));
    setPage(1);
  }

  function resetFilters() {
    setDraft(emptyFilters);
    setApplied(emptyFilters);
    setPage(1);
  }

  return (
    <div className="app-page">
      <PageHead
        title="Find teachers"
        subtitle="Browse active teacher profiles and filter by qualifications, experience, availability, location and rates."
        actions={<Btn icon="plus" onClick={() => go("post-job")}>Post a job</Btn>}
      />

      <div className="three-panel">
        <aside aria-label="Teacher filters" className="sidebar-panel card-pad self-start">
          <div className="sidebar-heading">
            <span className="flex items-center gap-2"><Icon name="filter" size={17} /> Filters</span>
            <button
              className="text-xs font-medium text-brand hover:underline disabled:text-muted disabled:no-underline"
              disabled={!hasDraftFilters}
              onClick={resetFilters}
              type="button"
            >
              Reset
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <Field label="Subject">
              <input className="input" onChange={(event) => update("subject", event.target.value)} placeholder="e.g. Mathematics" value={draft.subject} />
            </Field>
            <Field label="Key stage">
              <select className="select" onChange={(event) => update("keyStage", event.target.value)} value={draft.keyStage}>
                {stageOptions.map((stage) => <option key={stage || "all"} value={stage}>{stage || "All key stages"}</option>)}
              </select>
            </Field>
            <Field label="Skill">
              <input className="input" onChange={(event) => update("skill", event.target.value)} placeholder="e.g. SEN" value={draft.skill} />
            </Field>
            <Field label="City">
              <input className="input" onChange={(event) => update("city", event.target.value)} placeholder="e.g. Leeds" value={draft.city} />
            </Field>
            <Field label="Minimum experience">
              <input className="input" min={0} onChange={(event) => update("minExperience", event.target.value)} placeholder="Years" type="number" value={draft.minExperience} />
            </Field>
            <Field label="Minimum rating">
              <select className="select" onChange={(event) => update("minRating", event.target.value)} value={draft.minRating}>
                <option value="">Any rating</option>
                <option value="3">3+ stars</option>
                <option value="4">4+ stars</option>
                <option value="4.5">4.5+ stars</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Max hourly rate">
                <input className="input" min={0} onChange={(event) => update("maxHourlyRate", event.target.value)} placeholder="GBP" type="number" value={draft.maxHourlyRate} />
              </Field>
              <Field label="Max daily rate">
                <input className="input" min={0} onChange={(event) => update("maxDailyRate", event.target.value)} placeholder="GBP" type="number" value={draft.maxDailyRate} />
              </Field>
            </div>
          </div>

          <div className="sidebar-section mt-5 flex flex-col gap-3">
            <Checkbox checked={draft.dbsVerified} onChange={(value) => update("dbsVerified", value)} label="DBS verified only" />
            <Checkbox checked={draft.qtsQualified} onChange={(value) => update("qtsQualified", value)} label="QTS qualified" />
            <Checkbox checked={draft.availableToday} onChange={(value) => update("availableToday", value)} label="Available today" />
          </div>
          <Btn className="mt-5 w-full" icon="filter" onClick={applyFilters}>Apply filters</Btn>
        </aside>

        <div className="min-w-0">
          <form
            className="mb-5 flex flex-wrap items-center gap-3"
            onSubmit={(event) => { event.preventDefault(); applyFilters(); }}
          >
            <label className="flex min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-border-strong bg-white px-3.5 py-2.5">
              <Icon name="search" size={16} />
              <span className="sr-only">Search teachers</span>
              <input
                className="min-w-0 flex-1 border-0 bg-transparent outline-none"
                onChange={(event) => update("search", event.target.value)}
                placeholder="Search by name, city or county"
                value={draft.search}
              />
            </label>
            <Btn icon="search" type="submit">Search</Btn>
          </form>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-heading text-lg">
                {teachersQuery.isLoading ? "Finding teachers" : `${pagination?.total ?? instructors.length} teachers`}
              </div>
              <div className="text-xs text-muted">Active profiles, highest rated first</div>
            </div>
            {teachersQuery.isFetching && !teachersQuery.isLoading ? <span className="text-xs text-muted">Refreshing…</span> : null}
          </div>

          <div className="flex flex-col gap-3">
            {teachersQuery.isLoading ? <SectionLoader rows={4} /> : null}
            {teachersQuery.isError ? (
              <div className="card card-pad text-center" role="alert">
                <div className="font-semibold">Teachers could not be loaded</div>
                <p className="mt-1 text-sm text-muted">{teachersQuery.error.message}</p>
                <Btn className="mt-3" size="sm" variant="secondary" onClick={() => void teachersQuery.refetch()}>Try again</Btn>
              </div>
            ) : null}
            {instructors.map((teacher) => (
              <TeacherDirectoryCard key={teacher.id} teacher={teacher} onOpen={() => go("teacher-profile", { teacherId: teacher.id })} />
            ))}
            {!teachersQuery.isLoading && !teachersQuery.isError && instructors.length === 0 ? (
              <div className="card card-pad-lg text-center">
                <div className="font-heading text-xl">No teachers match these filters</div>
                <p className="mt-1 text-sm text-muted">Try widening the location, rate or qualification filters.</p>
                <Btn className="mt-4" size="sm" variant="secondary" onClick={resetFilters}>Clear filters</Btn>
              </div>
            ) : null}
          </div>

          {pagination && pagination.totalPages > 1 ? (
            <nav aria-label="Teacher pages" className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Btn disabled={page <= 1 || teachersQuery.isFetching} size="sm" variant="ghost" onClick={() => setPage((current) => current - 1)}>Previous</Btn>
              {pageItems(page, pagination.totalPages).map((item, index) => typeof item === "number" ? (
                <button
                  key={item}
                  aria-current={item === page ? "page" : undefined}
                  aria-label={`Page ${item}`}
                  className={`h-9 min-w-9 rounded-lg border px-2 text-sm font-semibold ${item === page ? "border-brand bg-brand text-white" : "border-border bg-white text-slate hover:border-brand hover:text-brand"}`}
                  disabled={teachersQuery.isFetching}
                  onClick={() => setPage(item)}
                  type="button"
                >
                  {item}
                </button>
              ) : <span key={`${item}-${index}`} aria-hidden="true" className="px-1 text-muted">…</span>)}
              <Btn disabled={!pagination.hasNextPage || teachersQuery.isFetching} size="sm" variant="ghost" onClick={() => setPage((current) => current + 1)}>Next</Btn>
            </nav>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TeacherDirectoryCard({ teacher, onOpen }: { teacher: TeacherDirectoryItem; onOpen: () => void }) {
  const location = [teacher.city, teacher.county].filter(Boolean).join(", ") || "Location not provided";
  const tags = [...teacher.subjects, ...teacher.keyStages, ...teacher.skills].slice(0, 6);

  return (
    <button className="card card-pad flex w-full flex-wrap items-start gap-4 text-left transition hover:border-brand hover:shadow-card" onClick={onOpen} type="button">
      <Avatar name={teacher.fullName} size="lg" src={teacher.imageUrl} />
      <span className="min-w-[220px] flex-1">
        <span className="mb-1 flex flex-wrap items-center gap-2">
          <span className="font-heading text-lg">{teacher.fullName}</span>
          {teacher.dbsVerified ? <VerifyBadge /> : null}
          {teacher.qtsQualified ? <Tag tone="ghost">QTS</Tag> : null}
          {teacher.availableToday ? <Tag tone="green">Available today</Tag> : null}
        </span>
        {teacher.bio ? <span className="block text-sm leading-6 text-muted">{teacher.bio}</span> : null}
        <span className="mt-2 flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1 text-muted"><Icon name="pin" size={12} />{location}</span>
          <span className="flex items-center gap-1"><Stars rating={teacher.ratingAverage} />{formatRating(teacher.ratingAverage)} ({teacher.ratingCount})</span>
          {teacher.experience !== null ? <span className="text-muted">{teacher.experience} years experience</span> : null}
        </span>
        {tags.length ? <span className="mt-3 flex flex-wrap gap-1.5">{tags.map((tag) => <Tag key={tag} tone="ghost">{tag}</Tag>)}</span> : null}
      </span>
      <span className="min-w-[120px] text-right">
        {teacher.dailyRate !== null ? <span className="block"><span className="font-heading text-lg">{formatMoney(teacher.dailyRate, teacher.currency)}</span><span className="block text-xs text-muted">per day</span></span> : null}
        {teacher.hourlyRate !== null ? <span className="mt-2 block text-sm font-semibold">{formatMoney(teacher.hourlyRate, teacher.currency)}<span className="font-normal text-muted"> / hour</span></span> : null}
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand">View profile <Icon name="arrowRight" size={13} /></span>
      </span>
    </button>
  );
}

function trimFilters(filters: DirectoryForm): DirectoryForm {
  return Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])) as DirectoryForm;
}

function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function formatMoney(value: number, currency: string | null) {
  try {
    return new Intl.NumberFormat("en-GB", { currency: currency || "GBP", maximumFractionDigits: 2, style: "currency" }).format(value);
  } catch {
    return `£${value}`;
  }
}

function formatRating(value: number) {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(value);
}

function pageItems(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  const pages = Array.from(new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages]))
    .filter((candidate) => candidate >= 1 && candidate <= totalPages)
    .sort((left, right) => left - right);
  const items: Array<number | "ellipsis"> = [];
  pages.forEach((candidate, index) => {
    if (index > 0 && candidate - pages[index - 1] > 1) items.push("ellipsis");
    items.push(candidate);
  });
  return items;
}
