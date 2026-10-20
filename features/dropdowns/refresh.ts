export const dropdownValidationCodes = new Set(["INVALID_DROPDOWN_SELECTION", "DROPDOWNS_NOT_SEEDED", "INVALID_TEACHING_SELECTION", "INVALID_OTHER_SUBJECTS", "INVALID_OTHER_SKILLS", "SKILL_SUBJECT_MISMATCH", "CONFLICTING_JOB_SUBJECTS"]);
export function refreshDropdownsAfterFailure(result: unknown) {
  if (typeof window !== "undefined" && result && typeof result === "object" && "code" in result && dropdownValidationCodes.has(String(result.code))) window.dispatchEvent(new Event("supplyed:refresh-dropdowns"));
}
