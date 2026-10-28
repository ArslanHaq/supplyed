import type { TeachingCatalogue } from "./types";

/** Preserve a legacy sentence as one reviewable value; never infer subjects from prose. */
export function selectionValues(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : typeof value === "string" && value.trim() ? [value] : [];
}

export function jobSubjects(job: { subjects?: string[] | null; subject?: string | null }): string[] {
  return Array.isArray(job.subjects) ? selectionValues(job.subjects) : job.subject && job.subject !== "General cover" ? [job.subject] : [];
}

export const subjectKey = (value: string) => value.toLowerCase().replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const key = subjectKey;
export function canonicalSubjects(values: string[], catalogue: TeachingCatalogue): string[] {
  const subjects = catalogue.categories.flatMap(category => category.subjects);
  return [...new Set(values.map(value => {
    const matches = subjects.filter(subject => [subject.name, ...subject.aliases].some(alias => key(alias) === key(value)));
    return matches.length === 1 ? matches[0].name : value;
  }))];
}

export function allowedSkills(subjects: string[], catalogue: TeachingCatalogue): string[] {
  const names = canonicalSubjects(subjects, catalogue);
  if (catalogue.skillOptions && catalogue.subjectOptions) {
    const keys = new Set(catalogue.subjectOptions.filter(option => option.isActive && names.includes(option.value) && option.value !== "Other").map(option => option.key));
    return catalogue.skillOptions.filter(option => option.isActive && (option.isShared || option.subjectKeys.some(key => keys.has(key)))).map(option => option.value);
  }
  return [...new Set([...catalogue.sharedSkills, ...catalogue.categories.flatMap(category => category.subjects).filter(subject => names.includes(subject.name)).flatMap(subject => subject.skills)])];
}

export function reconcileSkills(subjects: string[], skills: string[], catalogue: TeachingCatalogue): string[] {
  const allowed = new Set(allowedSkills(subjects, catalogue));
  return [...new Set(skills.filter(skill => allowed.has(skill)))];
}

export function catalogueError(code?: string) {
  return code === "INVALID_OTHER_SUBJECTS" || code === "INVALID_OTHER_SKILLS" || code === "INVALID_DROPDOWN_SELECTION" || code === "INVALID_TEACHING_SELECTION" || code === "SKILL_SUBJECT_MISMATCH" || code === "CONFLICTING_JOB_SUBJECTS";
}

export function toSkillEditor(catalogue: TeachingCatalogue | undefined, values: string[], otherSkills?: string[]) {
  if (!catalogue) return { skills: values, otherSkills };
  const options = catalogue.skillOptions ?? [...new Set([...catalogue.sharedSkills, ...catalogue.categories.flatMap(category => category.subjects.flatMap(subject => subject.skills))])].map(value => ({ value, aliases: [] as string[] }));
  const canonical = [...new Set(values.map(value => options.find(option => [option.value, ...option.aliases].some(alias => key(alias) === key(value)))?.value ?? value))];
  if (otherSkills !== undefined) return { skills: canonical, otherSkills };
  const known = new Set(options.map(option => option.value));
  const custom = canonical.filter(value => !known.has(value));
  return { skills: [...canonical.filter(value => known.has(value)), ...(custom.length ? ["Other"] : [])], otherSkills: custom };
}

export function otherSkillsError(skills: string[] | undefined, values: unknown, catalogue?: TeachingCatalogue): string | undefined {
  const error = otherSubjectsError(skills, values);
  if (error) return error.replace(/subjects/g, "skills").replace(/subject names/g, "skill names");
  if (catalogue && Array.isArray(values)) {
    const options = catalogue.skillOptions ?? [...new Set([...catalogue.sharedSkills, ...catalogue.categories.flatMap(category => category.subjects.flatMap(subject => subject.skills))])].map(value => ({ value, aliases: [] as string[] }));
    const match = options.find(option => values.some(value => [option.value, ...option.aliases].some(alias => key(alias) === key(value))));
    if (match) return `Select ${match.value} from the skills menu instead of entering it under Other.`;
  }
  return undefined;
}

/** Responses store actual names. Only requests contain Other + otherSubjects. */
export function toSubjectEditor(catalogue: TeachingCatalogue | undefined, values: string[], otherSubjects?: string[]) {
  if (!catalogue) return { subjects: values, otherSubjects };
  const canonical = canonicalSubjects(values, catalogue);
  if (otherSubjects !== undefined) return { subjects: canonical, otherSubjects };
  const known = new Set(catalogue.categories.flatMap(category => category.subjects.map(subject => subject.name)));
  const custom = canonical.filter(value => !known.has(value));
  return { subjects: [...new Set([...canonical.filter(value => known.has(value)), ...(custom.length ? ["Other"] : [])])], otherSubjects: custom };
}

export function cleanOtherSubjects(values: string[]): string[] {
  const unique = new Map<string, string>();
  for (const value of values) {
    const cleaned = value.trim().replace(/\s+/gu, " ");
    if (!unique.has(subjectKey(cleaned))) unique.set(subjectKey(cleaned), cleaned);
  }
  return [...unique.values()];
}

export function actualSubjects(subjects: string[], otherSubjects?: string[]) {
  return !Array.isArray(subjects) || !Array.isArray(otherSubjects) ? subjects : [...subjects.filter(value => value !== "Other"), ...otherSubjects];
}

export function otherSubjectsError(subjects: string[] | undefined, values: unknown, catalogue?: TeachingCatalogue): string | undefined {
  if (subjects !== undefined && !Array.isArray(subjects)) return undefined;
  // Omission deliberately preserves custom names during a PATCH.
  if (values === undefined) return subjects?.includes("Other") ? "Add at least one name under Other subjects." : undefined;
  if (!Array.isArray(values) || values.length > 50 || values.some(value => typeof value !== "string" || value.length > 100 || /\p{Cc}/u.test(value) || !subjectKey(value))) return "Use up to 50 subject names, each 1–100 characters, without control characters.";
  const names = values as string[];
  if (catalogue) {
    const known = catalogue.categories.flatMap(category => category.subjects);
    const match = known.find(subject => names.some(name => [subject.name, ...subject.aliases].some(alias => subjectKey(alias) === subjectKey(name))));
    if (match) return `Select ${match.name} from the catalogue instead of entering it under Other.`;
  }
  if (subjects && subjects.includes("Other") !== (names.length > 0)) return "Select Other and add at least one name, or remove Other and clear its names.";
  if ((subjects?.filter(value => value !== "Other").length ?? 0) + cleanOtherSubjects(names).length > 50) return "Select up to 50 subjects in total, including Other subjects.";
  return undefined;
}
