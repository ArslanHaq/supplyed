import { otherSubjectsError, otherSkillsError } from "@/features/teaching-catalogue/selection";
import { validateUkPhone, validateUkPostcode, validateUkCountry, validateUkCity, validateUkRegion } from "@/lib/uk-validation";
import type { SignupErrors, SignupForm, SignupRole, SignupStep } from "./types";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const domainPattern = /^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z]{2,63}$/i;
const companyNumberPattern = /^(?:\d{1,8}|[a-z]{2}\d{6})$/i;

export function validateOnboardingStep(form: SignupForm, activeRole: SignupRole, targetStep: SignupStep, roleSelected = true, accountEmail?: string): SignupErrors {
    const nextErrors: SignupErrors = {};
    const maxLength = (field: keyof SignupErrors & keyof SignupForm, limit: number) => {
      const value = form[field];
      if (typeof value === "string" && value.trim().length > limit) nextErrors[field] = `Use ${limit.toLocaleString("en-GB")} characters or fewer.`;
    };

    if ((targetStep === 1 && activeRole === "teacher") || (targetStep === 2 && activeRole === "institution")) {
      const problem = otherSubjectsError(activeRole === "teacher" ? form.subjects : form.staffingNeeds, form.otherSubjects);
      if (problem) nextErrors.otherSubjects = problem;
      if (activeRole === "teacher") { const skillProblem = otherSkillsError(form.skills, form.otherSkills); if (skillProblem) nextErrors.otherSkills = skillProblem; }
    }
    if (targetStep === 1) {
      if (!roleSelected) nextErrors.accountRole = "Choose how you want to use SupplyED.";
      if (!form.fullName.trim()) nextErrors.fullName = "Enter your full name.";
      maxLength("fullName", 120);
      const phone = validateUkPhone(form.phone, { required: true });
      if (!phone.valid) nextErrors.phone = phone.error;
      if (roleSelected && activeRole !== "institution") {
        const country = validateUkCountry(form.profileCountryCode, { required: true });
        const city = validateUkCity(form.profileCity, { required: true });
        if (!country.valid) nextErrors.profileCountryCode = country.error;
        if (!city.valid) nextErrors.profileCity = city.error;
      }
      if (activeRole === "teacher") {
        maxLength("profileAddress", 250);
        const postcode = validateUkPostcode(form.postcode, { required: true });
        if (!postcode.valid) nextErrors.postcode = postcode.error;
      }

      if (activeRole === "teacher") {
        if (form.keyStages.length === 0) nextErrors.keyStages = "Choose at least one key stage.";
        for (const field of ["subjects", "keyStages", "skills"] as const) {
          if (form[field].length > (field === "keyStages" ? 100 : 50) || form[field].some((item) => !item.trim() || item.length > 100)) nextErrors[field] = "Choose valid options.";
        }
        if (!form.yearsExperience.trim()) nextErrors.yearsExperience = "Enter your years of experience.";
        else if (!/^\d+$/.test(form.yearsExperience.trim()) || !Number.isFinite(Number(form.yearsExperience))) nextErrors.yearsExperience = "Enter a whole number of years, zero or more.";
        for (const [field, label] of [["hourlyRate", "Hourly rate"], ["dailyRate", "Daily rate"], ["maxTravelDistance", "Travel distance"]] as const) {
          if (form[field].trim() && (!/^\d+(?:\.\d+)?$/.test(form[field].trim()) || !Number.isFinite(Number(form[field])))) nextErrors[field] = `${label} must be a number, zero or more.`;
        }
        if (form.currency !== "GBP") nextErrors.currency = "Select GBP for UK rates.";
        if (form.bio.trim().length < 40) nextErrors.bio = "Write at least 40 characters so schools understand your teaching style.";
        maxLength("bio", 10000);
      }
    }

    if (targetStep === 2 && activeRole === "institution") {
      if (!form.schoolName.trim()) nextErrors.schoolName = "Enter the school or MAT name.";
      if (!form.contactRole.trim()) nextErrors.contactRole = "Enter your role.";
      if (!form.institutionDomain.trim()) nextErrors.institutionDomain = "Enter the school or trust domain.";
      else if (!domainPattern.test(form.institutionDomain.trim())) nextErrors.institutionDomain = "Use a valid domain, for example greenfield.ac.uk.";
      if (!form.institutionAddress.trim()) nextErrors.institutionAddress = "Enter the institution address.";
      const postcode = validateUkPostcode(form.postcode, { required: true });
      const country = validateUkCountry(form.institutionCountryCode, { required: true });
      const city = validateUkCity(form.institutionCity, { required: true });
      const region = validateUkRegion(form.localAuthority);
      if (!postcode.valid) nextErrors.postcode = postcode.error;
      if (!country.valid) nextErrors.institutionCountryCode = country.error;
      if (!city.valid) nextErrors.institutionCity = city.error;
      if (!region.valid) nextErrors.localAuthority = region.error;
      if (form.typicalPupilCount.trim() && (!/^\d+$/.test(form.typicalPupilCount.trim()) || !Number.isFinite(Number(form.typicalPupilCount)))) nextErrors.typicalPupilCount = "Enter a whole number of pupils, zero or more.";
      if (!["SINGLE_SCHOOL", "MAT_SCHOOL"].includes(form.institutionType)) nextErrors.institutionType = "Select the school type.";
      if (form.coverTypes.length === 0) nextErrors.coverTypes = "Choose at least one staffing need.";
      else if (form.coverTypes.length > 20 || form.coverTypes.some((item) => !item.trim() || item.length > 100)) nextErrors.coverTypes = "Choose valid staffing needs (up to 20).";
      maxLength("schoolName", 200);
      maxLength("contactRole", 100);
      maxLength("institutionAddress", 250);
      maxLength("institutionRegistrationId", 100);
      maxLength("institutionDomain", 253);
      if (form.staffingNeeds.length > 50 || form.staffingNeeds.some(item => !item.trim() || item.length > 100)) nextErrors.staffingNeeds = "Choose up to 50 subjects, each with 1 to 100 characters.";
      if (form.institutionType === "MAT_SCHOOL") {
        if (!form.trustName.trim()) nextErrors.trustName = "Enter the multi-academy trust name.";
        else if (form.trustName.trim().length > 200) nextErrors.trustName = "Trust name must be 200 characters or fewer.";
        const companyNumber = form.trustCompanyNumber.replace(/\s+/g, "");
        if (companyNumber && !companyNumberPattern.test(companyNumber)) {
          nextErrors.trustCompanyNumber = "Use up to 8 digits, or 2 letters followed by 6 digits.";
        }
      }
    }

    if (targetStep === 3 && activeRole === "institution") {
      if (form.institutionType === "SINGLE_SCHOOL") {
      if (!form.complianceContact.trim()) nextErrors.complianceContact = "Enter the safeguarding or compliance lead.";
      maxLength("complianceContact", 200);
      if (!form.complianceEmail.trim()) nextErrors.complianceEmail = "Enter the compliance email.";
      else if (!emailPattern.test(form.complianceEmail.trim())) nextErrors.complianceEmail = "Use a valid email address.";
      else if (form.complianceEmail.trim().toLowerCase() === (form.email || accountEmail || "").trim().toLowerCase()) nextErrors.complianceEmail = "The compliance contact must be someone other than you.";
      maxLength("complianceEmail", 254);
      }
      if (!form.safeguardingConfirmed) nextErrors.safeguardingConfirmed = "Confirm safeguarding responsibility.";
      if (form.institutionType === "MAT_SCHOOL") {
        if (!form.signatoryName.trim()) nextErrors.signatoryName = "Enter the trust signatory's name.";
        else if (form.signatoryName.trim().length > 200) nextErrors.signatoryName = "Signatory name must be 200 characters or fewer.";
        if (!form.signatoryEmail.trim()) nextErrors.signatoryEmail = "Enter the trust signatory's email.";
        else if (!emailPattern.test(form.signatoryEmail.trim())) nextErrors.signatoryEmail = "Use a valid email address.";
        else if (form.signatoryEmail.trim().length > 254) nextErrors.signatoryEmail = "Signatory email must be 254 characters or fewer.";
        else if (form.signatoryEmail.trim().toLowerCase() === (form.email || accountEmail || "").trim().toLowerCase()) {
          nextErrors.signatoryEmail = "The trust signatory must be someone other than you.";
        }
        if (!form.signatoryJobTitle.trim()) nextErrors.signatoryJobTitle = "Enter the trust signatory's job title.";
        else if (form.signatoryJobTitle.trim().length > 150) nextErrors.signatoryJobTitle = "Signatory job title must be 150 characters or fewer.";
      }
    }

    return nextErrors;
  }

