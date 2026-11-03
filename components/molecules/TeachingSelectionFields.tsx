"use client";
import { useState } from "react";
import { useTeachingCatalogue } from "@/features/teaching-catalogue/use-teaching-catalogue";
import type { TeachingCatalogue, TeachingCatalogueOptions } from "@/features/teaching-catalogue/types";
import type { SchoolType } from "@/types/supplyed";
import { allowedSkills, toSubjectEditor, toSkillEditor, cleanOtherSubjects, otherSubjectsError, otherSkillsError, reconcileSkills } from "@/features/teaching-catalogue/selection";
import { Field } from "../atoms";
import { MultiSelectDropdown, SelectDropdown, type SelectOption } from "./OptionDropdowns";

type CatalogueFieldOptions = {
  catalogueScope?: TeachingCatalogueOptions["scope"];
  schoolType?: SchoolType | null;
  onSchoolTypeRequired?: () => void;
};

function catalogueSubjectOptions(data: TeachingCatalogue): SelectOption[] {
  if (data.subjectOptions?.length) return data.subjectOptions.map(option => ({ label: option.label, value: option.value, group: option.group ?? undefined, keywords: option.aliases.join(" ") }));
  return data.categories.flatMap(category => category.subjects.map(subject => ({ label: subject.name, value: subject.name, group: category.name, keywords: subject.aliases.join(" ") })));
}

function catalogueSkillOptions(data: TeachingCatalogue, allowed: string[]): SelectOption[] {
  if (data.skillOptions?.length) return data.skillOptions.filter(option => allowed.includes(option.value)).map(option => ({ label: option.label, value: option.value, keywords: option.aliases.join(" ") }));
  return allowed.map(value => ({ label: value, value }));
}

export function TeachingSelectionFields({ subjects, skills, otherSubjects, otherSkills, otherError, otherSkillError, onChange, subjectLabel = "Subjects", skillLabel = "Skills", subjectError, skillError, catalogueScope = "all", schoolType, onSchoolTypeRequired }: {
  subjects: string[]; skills?: string[]; otherSubjects?: string[]; otherSkills?: string[]; otherError?: string; otherSkillError?: string; onChange: (subjects: string[], skills: string[], otherSubjects: string[], otherSkills: string[]) => void;
  subjectLabel?: string; skillLabel?: string; subjectError?: string; skillError?: string;
} & CatalogueFieldOptions) {
  const catalogue = useTeachingCatalogue({ scope: catalogueScope, schoolType });
  const [notice, setNotice] = useState("");
  if (!catalogue.data) return <CatalogueQueryStatus query={catalogue} awaitingSchoolType={catalogueScope === "schoolType" && !schoolType} onSchoolTypeRequired={onSchoolTypeRequired} />;
  const data = catalogue.data;
  const editor = toSubjectEditor(data, subjects, otherSubjects);
  const selected = editor.subjects;
  const custom = editor.otherSubjects ?? [];
  const skillEditor = toSkillEditor(data, skills ?? [], otherSkills);
  const selectedSkills = skillEditor.skills;
  const customSkills = skillEditor.otherSkills ?? [];
  const subjectOptions = catalogueSubjectOptions(data);
  const allowed = allowedSkills(selected, data);
  const skillOptions = catalogueSkillOptions(data, allowed);
  const hasParentSubject = selected.length > 0;
  function emit(nextSubjects: string[], nextSkills: string[], nextCustom: string[], nextOtherSkills = customSkills) { onChange(nextSubjects, nextSkills, nextCustom, nextSkills.includes("Other") ? nextOtherSkills : []); }
  function change(next: string[]) {
    const cleaned = reconcileSkills(next, selectedSkills, data);
    const removed = selectedSkills.filter(skill => !cleaned.includes(skill));
    setNotice(removed.length ? `Removed skills that do not apply to these subjects: ${removed.join(", ")}.` : "");
    emit(next, cleaned, next.includes("Other") ? custom : []);
  }
  function reviewValues(values: string[], supported: string[], remove: (value: string) => void) {
    return values.filter(value => !supported.includes(value)).map(value => <div key={value} className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-warning/20 bg-warning-tint p-3 text-sm"><span>{value} <strong className="text-warning">Needs review</strong></span><button type="button" className="font-semibold underline" onClick={() => remove(value)} aria-label={`Remove ${value}`}>Remove</button></div>);
  }
  return <div className="space-y-4">
    <Field label={subjectLabel} error={subjectError} hint="Search by subject or familiar abbreviation. Select up to 50.">
      <MultiSelectDropdown disabled={catalogue.isError} options={subjectOptions} value={selected} searchable maxSelections={50} placeholder={`Select ${subjectLabel.toLowerCase()}`} error={Boolean(subjectError)} onChange={change} />

    </Field>
    {selected.includes("Other") ? <Field label="Other subjects" error={otherError || otherSubjectsError(selected, custom, data)} hint="Add actual subject names one at a time. Custom subjects allow shared skills only; review any imported legacy names.">
      <OtherSubjectsInput value={custom} catalogue={data} maxItems={50 - selected.filter(value => value !== "Other").length} onChange={next => emit(selected, selectedSkills, next)} />
    </Field> : otherError ? <p role="alert" className="text-sm text-danger">{otherError}</p> : null}
    {skills !== undefined && hasParentSubject ? <Field label={skillLabel} error={skillError} hint="Shared teaching skills and skills for your selected subjects. Optional.">
      <MultiSelectDropdown disabled={catalogue.isError} options={skillOptions} value={selectedSkills} searchable maxSelections={50} placeholder={`Select ${skillLabel.toLowerCase()}`} error={Boolean(skillError)} onChange={next => emit(selected, next, custom)} />
      {reviewValues(selectedSkills, allowed, value => emit(selected, selectedSkills.filter(item => item !== value), custom))}
    </Field> : null}
    {skills !== undefined && hasParentSubject && selectedSkills.includes("Other") ? <Field label="Other skills" error={otherSkillError || otherSkillsError(selectedSkills, customSkills, data)} hint="Add each actual skill name. Existing named skills must be selected from the menu."><OtherSubjectsInput kind="skills" value={customSkills} catalogue={data} maxItems={50 - selectedSkills.filter(value => value !== "Other").length} onChange={next => emit(selected, selectedSkills, custom, next)} /></Field> : null}
    {skills !== undefined && !hasParentSubject ? <p className="text-sm text-muted">Choose at least one subject to see the skills available for it.</p> : null}
    <CatalogueQueryStatus query={catalogue} onSchoolTypeRequired={onSchoolTypeRequired} />
    {notice ? <p role="status" className="rounded-lg bg-brand-tint p-3 text-sm text-brand-dark">{notice}</p> : null}
  </div>;
}

type CatalogueQuery = ReturnType<typeof useTeachingCatalogue>;

function CatalogueQueryStatus({ query, awaitingSchoolType = false, onSchoolTypeRequired }: { query: CatalogueQuery; awaitingSchoolType?: boolean; onSchoolTypeRequired?: () => void }) {
  if (awaitingSchoolType) return <p role="status" className="rounded-xl border border-border bg-chalk p-4 text-sm text-muted">Choose whether this is a primary or secondary school to load the correct subjects.</p>;
  const code = query.error && typeof query.error === "object" && "code" in query.error ? String(query.error.code) : undefined;
  if (query.isError) return <div role="alert" className="rounded-xl border border-warning/20 bg-warning-tint p-4 text-sm">
    <p>{code === "SCHOOL_TYPE_REQUIRED" ? "Choose Primary or Secondary in the school profile before creating or editing jobs." : "Subjects and skills could not be loaded. Your other details are saved in this form."}</p>
    <div className="mt-2 flex flex-wrap gap-3">
      {code === "SCHOOL_TYPE_REQUIRED" && onSchoolTypeRequired ? <button type="button" className="font-semibold underline" onClick={onSchoolTypeRequired}>Update school profile</button> : null}
      <button type="button" className="font-semibold underline" onClick={() => void query.refetch()}>Try again</button>
    </div>
  </div>;
  return !query.data ? <p role="status" className="text-sm text-muted">Loading subjects and skills...</p> : null;
}

export function CatalogueStatus() {
  const query = useTeachingCatalogue();
  return <CatalogueQueryStatus query={query} />;
}

export function CatalogueSubjectFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const query = useTeachingCatalogue();
  const options = query.data ? catalogueSubjectOptions(query.data).filter(option => option.value !== "Other") : [];
  return <><SelectDropdown searchable disabled={!query.data || query.isError} placeholder="All subjects" value={value} onChange={onChange} options={[{ label: "All subjects", value: "" }, ...options]} /><label className="mt-2 block text-xs text-muted">Or enter an exact custom subject<input className="input mt-1" disabled={!query.data} maxLength={100} placeholder="e.g. Astronomy" value={options.some(option => option.value === value) ? "" : value} onChange={event => onChange(event.target.value)} /></label><CatalogueQueryStatus query={query} /></>;
}

export function CatalogueKeyStages({ value, onChange, error = false }: { value: string[]; onChange: (value: string[]) => void; error?: boolean }) {
  const query = useTeachingCatalogue();
  const options: SelectOption[] = query.data?.stageOptions?.length
    ? query.data.stageOptions.map(option => ({ label: option.label, value: option.value, keywords: option.aliases.join(" ") }))
    : (query.data?.keyStages ?? []).map(stage => ({ label: stage, value: stage }));
  return <div><MultiSelectDropdown searchable disabled={!query.data || query.isError} error={error} options={options} value={value} onChange={onChange} placeholder="Select key stages" /><CatalogueQueryStatus query={query} /></div>;
}

function OtherSubjectsInput({ value, onChange, catalogue, maxItems, kind = "subjects" }: { value: string[]; onChange: (value: string[]) => void; catalogue: import("@/features/teaching-catalogue/types").TeachingCatalogue; maxItems: number; kind?: "subjects" | "skills" }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>();
  function add() {
    if (!draft) return;
    const problem = (kind === "skills" ? otherSkillsError : otherSubjectsError)(["Other"], [draft], catalogue);
    if (problem) { setError(problem); return; }
    const next = cleanOtherSubjects([...value, draft]);
    if (next.length > maxItems) { setError(`Select up to 50 ${kind} in total.`); return; }
    onChange(next); setDraft(""); setError(undefined);
  }
  return <div>
    <div className="mb-2 flex flex-wrap gap-2">{value.map((name, index) => <span key={`${name}-${index}`} className="inline-flex max-w-full items-center gap-2 rounded-full bg-brand-tint px-3 py-1 text-sm"><span className="break-words">{name}</span><button type="button" aria-label={`Remove ${name}`} onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}>&times;</button></span>)}</div>
    <div className="flex gap-2"><input className="input min-w-0 flex-1" aria-label={kind === "skills" ? "Other skill name" : "Other subject name"} aria-invalid={Boolean(error)} maxLength={100} value={draft} placeholder={kind === "skills" ? "e.g. Telescope operation" : "e.g. Astronomy"} onChange={event => { setDraft(event.target.value); setError(undefined); }} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); add(); } }} /><button type="button" className="rounded-lg border border-border px-4 text-sm font-semibold" onClick={add}>Add</button></div>
    {draft ? <p className="mt-1 text-xs text-muted">Choose Add or press Enter to include this name before saving.</p> : null}
    {error ? <p role="alert" className="mt-1 text-sm text-danger">{error}</p> : null}
  </div>;
}
