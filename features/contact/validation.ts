import { validateEmail } from "@/features/auth/schemas";
import { validateUkPhone, validateUkPostcode } from "@/lib/uk-validation";
import type { WaitlistField } from "./actions";
import { coverBookingOptions, currentSupplyOptions, daysPerWeekOptions, supplyDaysOptions, waitlistPhases, waitlistSchoolAreas, waitlistSchoolRoles, waitlistSchoolTypes, waitlistTeacherAreas, waitlistTeacherRoles } from "./waitlist-options";

function read(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Used before the client request and again by the server action. */
export function validateWaitlist(form: FormData): Partial<Record<WaitlistField, string>> {
  const errors: Partial<Record<WaitlistField, string>> = {};
  const school = read(form, "type") === "SCHOOL";
  if (!["SCHOOL", "TEACHER"].includes(read(form, "type"))) errors.type = "Choose school or teacher.";
  if (!validateEmail(read(form, "email"))) errors.email = "Use a valid email address.";
  const choice = (key: WaitlistField, options: readonly string[], message: string) => {
    if (!options.includes(read(form, key))) errors[key] = message;
  };
  choice("role", school ? waitlistSchoolRoles : waitlistTeacherRoles, "Choose your role.");
  choice("area", school ? waitlistSchoolAreas : waitlistTeacherAreas, "Choose a UK area.");
  if (school) {
    const name = read(form, "name"), organization = read(form, "organizationName");
    if (name.length < 2 || name.length > 120) errors.name = "Enter your name (2–120 characters).";
    if (organization.length < 2 || organization.length > 160) errors.organizationName = "Enter your school name (2–160 characters).";
    choice("schoolType", waitlistSchoolTypes, "Choose your school type.");
    choice("supplyDaysPerTerm", supplyDaysOptions, "Choose your approximate supply days.");
    choice("coverBookingMethod", coverBookingOptions, "Choose how you book cover.");
  } else {
    const firstName = read(form, "firstName"), lastName = read(form, "lastName");
    if (!firstName || firstName.length > 60) errors.firstName = "Enter your first name (up to 60 characters).";
    if (!lastName || lastName.length > 60) errors.lastName = "Enter your last name (up to 60 characters).";
    if (`${firstName} ${lastName}`.trim().length > 120) errors.lastName = "Use 120 characters or fewer for your full name.";
    const phone = validateUkPhone(form.get("phone"));
    if (!phone.valid) errors.phone = phone.error;
    choice("currentSupply", currentSupplyOptions, "Choose your current supply situation.");
    choice("daysPerWeek", daysPerWeekOptions, "Choose how many days you would like.");
    if (form.get("emailConsent") !== "on") errors.emailConsent = "Please agree to receive first-cohort and launch emails.";
  }
  return errors;
}

export function validateWaitlistDetails(form: FormData): Partial<Record<"phases" | "mainSubject" | "postcode", string>> {
  const errors: Partial<Record<"phases" | "mainSubject" | "postcode", string>> = {};
  if (form.getAll("phases").some(value => typeof value !== "string" || !(waitlistPhases as readonly string[]).includes(value))) errors.phases = "Choose valid teaching phases.";
  if (read(form, "mainSubject").length > 100) errors.mainSubject = "Use 100 characters or fewer.";
  const postcode = validateUkPostcode(form.get("postcode"));
  if (!postcode.valid) errors.postcode = postcode.error;
  return errors;
}
