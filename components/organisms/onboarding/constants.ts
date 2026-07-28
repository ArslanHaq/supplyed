import type { SignupForm, SignupRole } from "./types";

export const allowedDocumentContentTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
export const maxDocumentSizeBytes = 10 * 1024 * 1024;

export const initialForm: SignupForm = {
  bio: "",
  confirmPassword: "",
  contactRole: "",
  complianceContact: "",
  complianceEmail: "",
  coverTypes: [],
  currency: "GBP",
  dailyRate: "",
  dbsCertificateFile: null,
  dbsNumber: "",
  email: "",
  fullName: "",
  hourlyRate: "",
  identityPhoto: null,
  institutionAddress: "",
  institutionCity: "",
  institutionCountryCode: "GB",
  institutionDomain: "",
  institutionProfileId: "",
  institutionRegistrationId: "",
  keyStages: [],
  localAuthority: "",
  maxTravelDistance: "",
  password: "",
  phone: "",
  postcode: "",
  qualificationFile: null,
  recruiterProfileId: "",
  rightToWorkFile: null,
  safeguardingConfirmed: false,
  schoolName: "",
  skills: [],
  staffingNeeds: "",
  subjects: [],
  teacherProfileId: "",
  teachingReferenceNumber: "",
  termsAccepted: false,
  typicalPupilCount: "",
  yearsExperience: "",
};

export const subjects = ["Maths", "English", "Science", "Humanities", "SEN", "All Primary"];
export const keyStages = ["EYFS", "KS1", "KS2", "KS3", "KS4", "KS5"];
export const teacherSkills = ["Classroom management", "SEN support", "Safeguarding", "Behaviour support", "Phonics", "Exam preparation"];
export const coverTypes = ["Same-day cover", "Long-term roles", "Intervention groups", "Exam season", "SEN support"];
export const currencies = ["GBP"];
export const countryCodes = ["GB"];

export const unselectedSteps = [
  { label: "Choose role", description: "Select how you want to use SupplyED" },
  { label: "Role details", description: "Complete the details needed for that path" },
  { label: "Verification", description: "Provide required safety or compliance details" },
  { label: "Review", description: "Confirm before submitting" },
];

export function stepContent(role: SignupRole) {
  if (role === "teacher") {
    return [
      { label: "Teacher profile", description: "Contact details, subjects, rates, travel, and teaching style" },
      { label: "Required documents", description: "Enhanced DBS, identity, qualification, and proof-of-address evidence" },
      { label: "Review", description: "Confirm your teacher profile" },
    ];
  }

  if (role === "individual") {
    return [
      { label: "Your profile", description: "Create your hiring profile with basic contact details" },
      { label: "Review", description: "Confirm your profile before opening the hiring workspace" },
    ];
  }

  return [
    { label: "Contact details", description: "Add contact details for your verified account" },
    { label: "School details", description: "Organisation, cover needs, and authority" },
    { label: "Compliance", description: "Safeguarding contact and approval details" },
    { label: "Review", description: "Confirm your school workspace" },
  ];
}
