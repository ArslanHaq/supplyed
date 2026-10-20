/** Unrelated profile edits must not revalidate legacy catalogue values. */
import { actualSubjects } from "./selection";

/** Retired reference values on unchanged fields must not block unrelated edits. */
export function omitUnchangedDropdownFields(payload: object, saved: object | null | undefined) {
  if (!saved) return;
  const current = payload as Record<string, unknown>, previous = saved as Record<string, unknown>;
  for (const field of ["city", "county", "countryCode", "currency", "keyStages", "coverTypes", "institutionType"]) {
    if (field in current && JSON.stringify(current[field]) === JSON.stringify(previous[field])) delete current[field];
  }
}

export function omitUnchangedTeachingFields(payload: { subjects?: string[]; skills?: string[]; staffingNeeds?: string[]; otherSubjects?: string[]; otherSkills?: string[] }, saved: { subjects?: string[]; skills?: string[]; staffingNeeds?: string[] } | null | undefined) {
  if (!saved) return;
  const same = (left?: string[], right?: string[]) => JSON.stringify(left ?? []) === JSON.stringify(right ?? []);
  if (("subjects" in payload || "skills" in payload) && same(actualSubjects(payload.subjects ?? [], payload.otherSubjects), saved.subjects) && same(actualSubjects(payload.skills ?? [], payload.otherSkills), saved.skills)) {
    delete payload.subjects;
    delete payload.skills;
    delete payload.otherSubjects;
    delete payload.otherSkills;
  }
  if ("staffingNeeds" in payload && same(actualSubjects(payload.staffingNeeds ?? [], payload.otherSubjects), saved.staffingNeeds)) { delete payload.staffingNeeds; delete payload.otherSubjects; }
}
