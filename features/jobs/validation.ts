import { validateWorkUnits } from "./work-units";
import { validateJobDateOrder } from "./date-validation";
import { otherSubjectsError, otherSkillsError } from "@/features/teaching-catalogue/selection";
import { validateUkCity, validateUkCountry, validateUkPostcode, validateUkRegion } from "@/lib/uk-validation";
import { isEmptyRichText, richTextToPlainText } from "@/features/applications/rich-text";
import { ukCalendarDate } from "@/features/jobs/listing-window";
import type { JobCreateInput, JobUpdateInput } from "./types";

export function validateJobInput(input: JobCreateInput | JobUpdateInput, options: { partial?: boolean } = {}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return { title: "Enter valid job details." };
  const customError = input.otherSubjects !== undefined || !options.partial ? otherSubjectsError(input.subjects, input.otherSubjects) : undefined;
  if (customError) errors.otherSubjects = customError;
  const skillError = input.otherSkills !== undefined || !options.partial ? otherSkillsError(input.requiredSkills, input.otherSkills) : undefined;
  if (skillError) errors.otherSkills = skillError;
  for (const [key, max] of [["title", 200], ["description", 10000]] as const) {
    const value = input[key];
    const editable = key === "description" && typeof value === "string" ? value.split(/\r?\n/).filter(line => !/^(Posting route:\s*(Instant matching|Open brief)\.|Marked urgent by the hiring account\.|QTS requested\.)$/i.test(line.trim())).join("\n").trim() : value;
    if ((!options.partial || value !== undefined) && (typeof editable !== "string" || !editable.trim() || editable.length > max || (key === "description" && isEmptyRichText(editable)))) errors[key] = `Enter ${key === "title" ? "a title" : "a description"} (up to ${max.toLocaleString()} characters).`;
    if (key === "description" && input.status === "ACTIVE" && typeof editable === "string" && richTextToPlainText(editable).length < 20) errors.description = "Add role details of at least 20 characters.";
  }
  for (const [key, validation] of Object.entries({
    countryCode: validateUkCountry(input.countryCode ?? (options.partial ? "" : "GB"), { required: input.countryCode !== undefined }),
    city: validateUkCity(input.city), county: validateUkRegion(input.county), postalCode: validateUkPostcode(input.postalCode),
  })) if (!validation.valid) errors[key] = validation.error!;
  for (const key of ["payAmount", "minExperienceYears"] as const) if (input[key] !== undefined && (typeof input[key] !== "number" || !Number.isFinite(input[key]) || input[key]! < 0 || (key === "minExperienceYears" && !Number.isInteger(input[key])))) errors[key] = "Enter a valid non-negative number.";
  if (input.payType !== undefined && !["hourly", "daily", "fixed"].includes(input.payType)) errors.payType = "Choose hourly, daily or fixed pay.";
  if (input.status !== undefined && !(options.partial ? ["DRAFT", "ACTIVE", "EXPIRED", "FILLED", "CLOSED"] : ["DRAFT", "ACTIVE"]).includes(input.status)) errors.status = "Choose a valid job status.";
  for (const key of ["keyStages", "requiredSkills", "subjects"] as const) {
    const values = input[key];
    if (values !== undefined && (!Array.isArray(values) || values.length > (key === "keyStages" ? 100 : 50) || values.some(value => typeof value !== "string" || !value.trim() || value.length > 100))) errors[key] = "Choose valid options.";
  }
  for (const [key, max] of [["address", 250], ["parkingInfo", 1000]] as const) if (input[key] !== undefined && (typeof input[key] !== "string" || input[key]!.length > max)) errors[key] = `Use ${max.toLocaleString()} characters or fewer.`;
  Object.assign(errors, validateWorkUnits(input, options.partial), validateJobDateOrder(input));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (input.startDate && !errors.startDate && ukCalendarDate(input.startDate) < today) errors.startDate = "Start date cannot be before today.";
  if (input.expiresAt && !errors.expiresAt && input.expiresAt.slice(0, 10) < today) errors.expiresAt = "Listing expiry cannot be before today.";
  if (input.latitude !== undefined && (typeof input.latitude !== "number" || !Number.isFinite(input.latitude) || Math.abs(input.latitude) > 90)) errors.latitude = "Enter a valid latitude.";
  if (input.longitude !== undefined && (typeof input.longitude !== "number" || !Number.isFinite(input.longitude) || Math.abs(input.longitude) > 180)) errors.longitude = "Enter a valid longitude.";
  return errors;
}
