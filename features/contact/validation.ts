import { validateEmail } from "@/features/auth/schemas";
import { validateUkPhone, validateUkPostcode } from "@/lib/uk-validation";
import type { WaitlistField } from "./actions";

function read(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Used before the client request and again by the server action. */
export function validateWaitlist(form: FormData, choices?: Record<string, string[]>): Partial<Record<WaitlistField, string>> {
  const errors: Partial<Record<WaitlistField, string>> = {};
  const school = read(form, "type") === "SCHOOL";
  if (!["SCHOOL", "TEACHER"].includes(read(form, "type"))) errors.type = "Choose school or teacher.";
  if (!validateEmail(read(form, "email"))) errors.email = "Use a valid email address.";
  const choice = (key: WaitlistField, collection: string, message: string) => {
    if (!read(form, key) || read(form, key).length > 100 || (choices && !choices[collection]?.includes(read(form, key)))) errors[key] = message;
  };
  choice("role", school ? "waitlistSchoolRole" : "waitlistTeacherRole", "Choose your role.");
  choice("area", school ? "waitlistSchoolArea" : "waitlistTeacherArea", "Choose a UK area.");
  if (school) {
    const name = read(form, "name"), organization = read(form, "organizationName");
    if (name.length < 2 || name.length > 120) errors.name = "Enter your name (2–120 characters).";
    if (organization.length < 2 || organization.length > 160) errors.organizationName = "Enter your school name (2–160 characters).";
    choice("schoolType", "waitlistSchoolType", "Choose your school type.");
    choice("supplyDaysPerTerm", "supplyDaysPerTerm", "Choose your approximate supply days.");
    choice("coverBookingMethod", "coverBookingMethod", "Choose how you book cover.");
  } else {
    const firstName = read(form, "firstName"), lastName = read(form, "lastName");
    if (!firstName || firstName.length > 60) errors.firstName = "Enter your first name (up to 60 characters).";
    if (!lastName || lastName.length > 60) errors.lastName = "Enter your last name (up to 60 characters).";
    if (`${firstName} ${lastName}`.trim().length > 120) errors.lastName = "Use 120 characters or fewer for your full name.";
    const phone = validateUkPhone(form.get("phone"));
    if (!phone.valid) errors.phone = phone.error;
    choice("currentSupply", "currentSupply", "Choose your current supply situation.");
    choice("daysPerWeek", "daysPerWeek", "Choose how many days you would like.");
    if (form.get("emailConsent") !== "on") errors.emailConsent = "Please agree to receive first-cohort and launch emails.";
  }
  return errors;
}

export function validateWaitlistDetails(form: FormData): Partial<Record<"phases" | "mainSubject" | "postcode", string>> {
  const errors: Partial<Record<"phases" | "mainSubject" | "postcode", string>> = {};
  if (form.getAll("phases").some(value => typeof value !== "string" || !value.trim() || value.length > 100)) errors.phases = "Choose valid teaching phases.";
  if (read(form, "mainSubject").length > 100) errors.mainSubject = "Use 100 characters or fewer.";
  const postcode = validateUkPostcode(form.get("postcode"));
  if (!postcode.valid) errors.postcode = postcode.error;
  return errors;
}
