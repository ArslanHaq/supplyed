import { otherSubjectsError, otherSkillsError } from "@/features/teaching-catalogue/selection";
import { validateEmail } from "@/features/auth/schemas";
import { validateUkCity, validateUkCountry, validateUkPhone, validateUkPostcode, validateUkRegion } from "@/lib/uk-validation";

const read = (form: FormData, key: string) => typeof form.get(key) === "string" ? String(form.get(key)).trim() : "";
export function validateOnboardingForm(form: FormData, options: { complete?: boolean } = {}): Record<string, string> {
  const errors: Record<string, string> = {};
  const role = read(form, "role"), step = Number(read(form, "step"));
  if (!["teacher", "institution"].includes(role)) errors.accountRole = "Choose how you want to use SupplyEd.";
  if (!Number.isInteger(step) || step < 1 || step > (role === "teacher" ? 2 : 4)) errors.step = "Choose a valid onboarding step.";
  const requiredText = (key: string, label: string, max = 200) => {
    if (!read(form, key) || read(form, key).length > max) errors[key] = `Enter ${label} (up to ${max} characters).`;
  };
  const check = (key: string, validation: { valid: boolean; error?: string }) => { if (!validation.valid) errors[key] = validation.error!; };
  const number = (key: string, required = false, integer = false) => {
    const value = read(form, key);
    if ((!value && required) || (value && (!(integer ? /^\d+$/ : /^(?:\d+(?:\.\d*)?|\.\d+)$/).test(value) || !Number.isFinite(Number(value)) || Number(value) < 0 || (integer && !Number.isInteger(Number(value)))))) errors[key] = "Enter a valid non-negative number.";
  };
  const list = (key: string, required = false) => {
    try {
      const items: unknown = JSON.parse(read(form, key) || "[]");
      if (!Array.isArray(items) || items.length > (key === "coverTypes" ? 20 : key === "keyStages" ? 100 : 50) || (required && items.length === 0) || items.some(item => typeof item !== "string" || !item.trim() || item.length > 100)) errors[key] = "Choose valid options.";
    } catch { errors[key] = "Choose valid options."; }
  };
  try {
    const subjects = JSON.parse(read(form, role === "teacher" ? "subjects" : "staffingNeeds") || "[]");
    const custom = form.has("otherSubjects") ? JSON.parse(read(form, "otherSubjects") || "[]") : undefined;
    const problem = otherSubjectsError(subjects, custom);
    if (problem) errors.otherSubjects = problem;
  } catch { errors.otherSubjects = "Enter valid Other subjects."; }
  if (role === "teacher") { try { const problem = otherSkillsError(JSON.parse(read(form, "skills") || "[]"), form.has("otherSkills") ? JSON.parse(read(form, "otherSkills") || "[]") : undefined); if (problem) errors.otherSkills = problem; } catch { errors.otherSkills = "Enter valid Other skills."; } }
  requiredText("fullName", "your full name", 120);
  check("phone", validateUkPhone(form.get("phone"), { required: true }));
  if (read(form, "email") && !validateEmail(read(form, "email"))) errors.email = "Use a valid email address.";
  const schoolDetails = role === "institution" && (options.complete || step >= 2);
  if (role === "teacher" || schoolDetails) check("postcode", validateUkPostcode(form.get("postcode"), { required: true }));
  if (role === "teacher") {
    check("profileCountryCode", validateUkCountry(form.get("profileCountryCode"), { required: true }));
    check("profileCity", validateUkCity(form.get("profileCity"), { required: true }));
    list("subjects"); list("keyStages", true); list("skills");
    number("yearsExperience", true, true); number("hourlyRate"); number("dailyRate"); number("maxTravelDistance");
    if (read(form, "currency") && read(form, "currency").toUpperCase() !== "GBP") errors.currency = "Use GBP for UK rates.";
    if (read(form, "bio").length < 40 || read(form, "bio").length > 10000) errors.bio = "Write between 40 and 10,000 characters about your teaching style.";
  }
  if (role === "institution") {
    if (schoolDetails) {
      check("institutionCountryCode", validateUkCountry(form.get("institutionCountryCode"), { required: true }));
      check("institutionCity", validateUkCity(form.get("institutionCity"), { required: true }));
      check("localAuthority", validateUkRegion(form.get("localAuthority")));
      number("typicalPupilCount", false, true);
      requiredText("schoolName", "the school or trust name", 200); requiredText("contactRole", "your role", 100); requiredText("institutionAddress", "the institution address", 250);
      if (read(form, "institutionRegistrationId").length > 100) errors.institutionRegistrationId = "Use 100 characters or fewer.";
      const domain = read(form, "institutionDomain").replace(/^https?:\/\//i, "").replace(/\/$/, "");
      if (domain.length > 253 || !/^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z]{2,63}$/i.test(domain)) errors.institutionDomain = "Enter a valid institution domain, for example school.org.uk.";
      if (!["SINGLE_SCHOOL", "MAT_SCHOOL"].includes(read(form, "institutionType"))) errors.institutionType = "Choose a valid institution type.";
      list("coverTypes", true);
      list("staffingNeeds");
      if (read(form, "institutionType") === "MAT_SCHOOL") {
        requiredText("trustName", "the multi-academy trust name");
        const company = read(form, "trustCompanyNumber").replace(/\s+/g, "");
        if (company && !/^(?:\d{1,8}|[A-Z]{2}\d{6})$/i.test(company)) errors.trustCompanyNumber = "Use up to 8 digits, or 2 letters followed by 6 digits.";
      }
    }
    if (options.complete || step >= 3) {
      requiredText("complianceContact", "the safeguarding or compliance lead");
      if (!validateEmail(read(form, "complianceEmail"))) errors.complianceEmail = "Use a valid compliance email address.";
      if (read(form, "safeguardingConfirmed") !== "true") errors.safeguardingConfirmed = "Confirm safeguarding responsibility.";
      if (read(form, "institutionType") === "MAT_SCHOOL") {
        requiredText("signatoryName", "the trust signatory's name"); requiredText("signatoryJobTitle", "the trust signatory's job title", 150);
        if (!validateEmail(read(form, "signatoryEmail"))) errors.signatoryEmail = "Use a valid signatory email address.";
        else if (read(form, "signatoryEmail").toLowerCase() === read(form, "email").toLowerCase()) errors.signatoryEmail = "The trust signatory must be someone other than you.";
      }
    }
  }
  return errors;
}

/** Only called after validation; invalid values are never replaced with guesses. */
export function normalizeOnboardingForm(form: FormData): FormData {
  const normalized = new FormData();
  form.forEach((value, key) => normalized.append(key, value));
  const fields = {
    phone: validateUkPhone(form.get("phone")), postcode: validateUkPostcode(form.get("postcode")),
    profileCountryCode: validateUkCountry(form.get("profileCountryCode")), institutionCountryCode: validateUkCountry(form.get("institutionCountryCode")),
    profileCity: validateUkCity(form.get("profileCity")), institutionCity: validateUkCity(form.get("institutionCity")), localAuthority: validateUkRegion(form.get("localAuthority")),
  };
  for (const [key, value] of Object.entries(fields)) if (value.valid && form.has(key)) normalized.set(key, value.value);
  return normalized;
}
