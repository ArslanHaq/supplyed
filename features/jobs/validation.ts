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
  for (const key of ["payAmount", "minExperienceYears"] as const) {
    const value = input[key];
    if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value) || value < 0 || (key === "minExperienceYears" && !Number.isInteger(value)))) errors[key] = "Enter a valid non-negative number.";
    else if (key === "payAmount" && value !== undefined && value > 5000) errors.payAmount = "Pay amount cannot exceed £5,000.";
    else if (key === "minExperienceYears" && value !== undefined && value > 80) errors.minExperienceYears = "Experience cannot exceed 80 years.";
  }
  if (input.payType !== undefined && !["hourly", "daily", "fixed"].includes(input.payType)) errors.payType = "Choose hourly, daily or fixed pay.";
  if (input.status !== undefined && !(options.partial ? ["DRAFT", "ACTIVE", "CLOSED", "SUSPENDED"] : ["DRAFT", "ACTIVE"]).includes(input.status)) errors.status = "Choose a valid job status.";
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
  if (input.status === "ACTIVE" && !options.partial) Object.assign(errors, validatePublishableTerms(input));
  return errors;
}

export function validatePublishableTerms(input: Partial<Omit<JobCreateInput, "status" | "liveFrom">> & { liveFrom?: string | null }, now = Date.now()): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.title?.trim()) errors.title = "Enter a job title.";
  if (richTextToPlainText(input.description ?? "").trim().length < 20) errors.description = "Add meaningful role details of at least 20 characters.";
  if (!input.subjects?.length) errors.subjects = "Select at least one subject.";
  if (!input.keyStages?.length) errors.keyStages = "Select at least one key stage.";
  for (const field of ["address", "city", "postalCode", "countryCode"] as const) if (!input[field]?.trim()) errors[field] = `Enter the work ${field === "postalCode" ? "postcode" : field === "countryCode" ? "country code" : field}.`;
  const start = Date.parse(input.startDate ?? "");
  const end = Date.parse(input.endDate ?? "");
  if (!Number.isFinite(start) || start <= now) errors.startDate = "Choose a future start date and time.";
  if (!Number.isFinite(end) || end < start) errors.endDate = "Choose an end date on or after work starts.";
  if (!(Number(input.payAmount) > 0)) errors.payAmount = "Enter positive pay.";
  else if (Number(input.payAmount) > 5000) errors.payAmount = "Pay amount cannot exceed £5,000.";
  if (input.minExperienceYears != null && Number(input.minExperienceYears) > 80) errors.minExperienceYears = "Experience cannot exceed 80 years.";
  if (!["hourly", "daily", "fixed"].includes(input.payType ?? "")) errors.payType = "Choose hourly, daily or fixed pay.";
  const hours = (end - start) / 3600000;
  const days = Math.floor((Date.parse(`${ukCalendarDate(input.endDate)}T00:00:00Z`) - Date.parse(`${ukCalendarDate(input.startDate)}T00:00:00Z`)) / 86400000) + 1;
  for (const [field, type, max] of [["hours", "hourly", hours], ["days", "daily", days]] as const) {
    const value = input[field];
    if (input.payType === type && (!Number.isInteger(value) || Number(value) <= 0 || Number(value) > max)) errors[field] = `Enter positive whole ${field} within the work period.`;
    if (input.payType !== type && value != null) errors[field] = `Remove ${field} for ${input.payType ?? "this"} pay.`;
  }
  if (input.expiresAt && Date.parse(input.expiresAt) <= now) errors.expiresAt = "Choose a future listing expiry.";
  Object.assign(errors, validateJobDateOrder(input));
  return errors;
}
