import { actualSubjects, otherSubjectsError, otherSkillsError } from "@/features/teaching-catalogue/selection";
import { validateEmail } from "@/features/auth/schemas";
import { validateUkCity, validateUkCountry, validateUkPhone, validateUkPostcode, validateUkRegion } from "@/lib/uk-validation";
import type { SettingsUpdateInput } from "./types";

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
export function validateSettingsInput(input: SettingsUpdateInput, saved?: { subjects?: string[]; skills?: string[]; staffingNeeds?: string[] }): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input || !input.user || !["teacher", "institution", "admin"].includes(input.role)) return { name: "Check your account details and try again." };
  if (!text(input.user.name) || text(input.user.name).length > 120) errors.name = "Enter your display name (up to 120 characters).";
  const phone = validateUkPhone(input.user.phone);
  if (!phone.valid) errors.phone = phone.error!;
  const profile = input.role === "teacher" ? input.instructor : input.role === "institution" ? input.institution : undefined;
  if (input.role !== "admin" && !profile) return { ...errors, name: "Refresh the page to load your profile before saving." };
  if (!profile) return errors;
  for (const [field, validation] of Object.entries({
    countryCode: validateUkCountry(profile.countryCode, { required: true }),
    city: validateUkCity(profile.city, { required: input.role === "institution" }),
    postalCode: validateUkPostcode(profile.postalCode),
    county: validateUkRegion(profile.county),
  })) if (!validation.valid) errors[field] = validation.error!;
  if (text(profile.address).length > 250 || (input.role === "institution" && !text(profile.address))) errors.address = "Enter an address of up to 250 characters.";
  const numbers = input.role === "teacher" ? ["hourlyRate", "dailyRate", "experience", "maxTravelDistance"] : ["typicalPupilCount"];
  for (const field of numbers) {
    const value = (profile as unknown as Record<string, unknown>)[field];
    if (value !== undefined && value !== "" && (typeof value !== "string" || !text(value) || !Number.isFinite(Number(value)) || Number(value) < 0 || (["experience", "typicalPupilCount"].includes(field) && !Number.isInteger(Number(value))))) errors[field] = "Enter a valid non-negative number.";
  }
  for (const field of input.role === "teacher" ? ["subjects", "keyStages", "skills"] : ["coverTypes", "staffingNeeds"]) {
    const values = (profile as unknown as Record<string, unknown>)[field];
    if (!Array.isArray(values) || values.length > (field === "coverTypes" ? 20 : field === "keyStages" ? 100 : 50) || values.some(value => typeof value !== "string" || !value.trim() || value.length > 100)) errors[field] = "Choose valid options (up to 100 characters each).";
  }
  if (input.role === "teacher" && input.instructor) {
    if (!text(input.instructor.fullName) || text(input.instructor.fullName).length > 120) errors.fullName = "Enter your teacher profile name (up to 120 characters).";
    if (text(input.instructor.bio).length > 10000) errors.bio = "Use 10,000 characters or fewer.";
    if (text(input.instructor.currency) && text(input.instructor.currency).toUpperCase() !== "GBP") errors.currency = "Use GBP for UK rates.";
  }
  if (input.role === "institution" && input.institution) {
    for (const [field, max] of [["registrationId", 100], ["userRole", 100], ["complianceContact", 200]] as const) if (typeof input.institution[field] !== "string" || text(input.institution[field]).length > max) errors[field] = `Use ${max} characters or fewer.`;
    if (!text(input.institution.name) || text(input.institution.name).length > 200) errors.schoolName = "Enter the school or organisation name (up to 200 characters).";
    const domain = text(input.institution.domain).replace(/^https?:\/\//i, "").replace(/\/$/, "");
    if (domain.length > 253 || !/^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z]{2,63}$/i.test(domain)) errors.domain = "Enter a valid institution domain, for example school.org.uk.";
    if (text(input.institution.complianceEmail) && !validateEmail(text(input.institution.complianceEmail))) errors.complianceEmail = "Use a valid compliance email.";
    if (typeof input.institution.safeguardingConfirmed !== "boolean") errors.safeguardingConfirmed = "Choose a valid safeguarding confirmation.";

  }
  const otherError = otherSubjectsError(input.role === "teacher" ? input.instructor?.subjects : input.institution?.staffingNeeds, profile.otherSubjects);
  if (otherError) errors.otherSubjects = otherError;
  if (input.instructor) { const problem = otherSkillsError(input.instructor.skills, input.instructor.otherSkills); if (problem) errors.otherSkills = problem; }
  if (saved) {
    const same = (left?: string[], right?: string[]) => JSON.stringify(left ?? []) === JSON.stringify(right ?? []);
    if (input.role === "teacher" && same(actualSubjects(input.instructor?.subjects ?? [], input.instructor?.otherSubjects), saved.subjects) && same(actualSubjects(input.instructor?.skills ?? [], input.instructor?.otherSkills), saved.skills)) { delete errors.subjects; delete errors.skills; delete errors.otherSubjects; delete errors.otherSkills; }
    if (input.role === "institution" && same(actualSubjects(input.institution?.staffingNeeds ?? [], input.institution?.otherSubjects), saved.staffingNeeds)) { delete errors.staffingNeeds; delete errors.otherSubjects; }
  }
  return errors;
}
