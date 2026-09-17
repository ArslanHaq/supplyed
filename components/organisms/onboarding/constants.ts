import type { SignupForm, SignupRole } from "./types";

export const initialForm: SignupForm = {
  bio: "",
  confirmPassword: "",
  contactRole: "",
  complianceContact: "",
  complianceEmail: "",
  coverTypes: [],
  currency: "GBP",
  dailyRate: "",
  documents: {},
  email: "",
  fullName: "",
  hourlyRate: "",
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
  profileCity: "",
  profileCountryCode: "GB",
  postcode: "",
  recruiterProfileId: "",
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
      { label: "Full review", description: "Review everything before creating the profile" },
    ];
  }

  if (role === "individual") {
    return [
      { label: "Profile details", description: "Create your hiring profile with basic contact details" },
      { label: "Full review", description: "Review everything before creating the profile" },
    ];
  }

  return [
    { label: "Contact details", description: "Add contact details for your verified account" },
    { label: "School details", description: "Organisation, cover needs, and authority" },
    { label: "Compliance", description: "Safeguarding contact and approval details" },
    { label: "Full review", description: "Review everything before creating the profile" },
  ];
}
