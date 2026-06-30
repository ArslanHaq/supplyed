import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import type { AppRole } from "@/types/supplyed";

import { Btn, Checkbox, Field, Icon, Logo, Tag } from "../atoms";
import { MultiSelectDropdown, SelectDropdown } from "../molecules/OptionDropdowns";

type SignupRole = Extract<AppRole, "institution" | "teacher" | "individual">;
type SignupStep = 1 | 2 | 3 | 4;
type SignupField =
  | "accountRole"
  | "fullName"
  | "email"
  | "phone"
  | "postcode"
  | "password"
  | "confirmPassword"
  | "termsAccepted"
  | "schoolName"
  | "contactRole"
  | "localAuthority"
  | "coverTypes"
  | "subjects"
  | "keyStages"
  | "yearsExperience"
  | "bio"
  | "dbsNumber"
  | "rightToWorkFile"
  | "identityPhoto"
  | "individualRelationship"
  | "learningMode"
  | "preferredSchedule"
  | "budgetRange"
  | "learnerNotes"
  | "individualConsent"
  | "complianceContact"
  | "complianceEmail"
  | "safeguardingConfirmed";

type SignupErrors = Partial<Record<SignupField, string>>;

type UploadedFile = {
  name: string;
  size: number;
  type: string;
};

type SignupForm = {
  fullName: string;
  email: string;
  phone: string;
  postcode: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
  schoolName: string;
  contactRole: string;
  localAuthority: string;
  coverTypes: string[];
  subjects: string[];
  keyStages: string[];
  yearsExperience: string;
  bio: string;
  dbsNumber: string;
  teachingReferenceNumber: string;
  rightToWorkFile: UploadedFile | null;
  identityPhoto: UploadedFile | null;
  individualRelationship: string;
  learningMode: string;
  preferredSchedule: string;
  budgetRange: string;
  learnerNotes: string;
  individualConsent: boolean;
  complianceContact: string;
  complianceEmail: string;
  safeguardingConfirmed: boolean;
};

type ReviewLine = {
  label: string;
  value: ReactNode;
  wide?: boolean;
};

type ReviewGroup = {
  title: string;
  description: string;
  icon: string;
  editStep: SignupStep;
  lines: ReviewLine[];
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[0-9+()\s-]{10,}$/;
const initialForm: SignupForm = {
  fullName: "",
  email: "",
  phone: "",
  postcode: "",
  password: "",
  confirmPassword: "",
  termsAccepted: false,
  schoolName: "",
  contactRole: "",
  localAuthority: "",
  coverTypes: [],
  subjects: [],
  keyStages: [],
  yearsExperience: "",
  bio: "",
  dbsNumber: "",
  teachingReferenceNumber: "",
  rightToWorkFile: null,
  identityPhoto: null,
  individualRelationship: "",
  learningMode: "",
  preferredSchedule: "",
  budgetRange: "",
  learnerNotes: "",
  individualConsent: false,
  complianceContact: "",
  complianceEmail: "",
  safeguardingConfirmed: false,
};

const subjects = ["Maths", "English", "Science", "Humanities", "SEN", "All Primary"];
const keyStages = ["EYFS", "KS1", "KS2", "KS3", "KS4", "KS5"];
const coverTypes = ["Same-day cover", "Long-term roles", "Intervention groups", "Exam season", "SEN support"];
const supportForOptions = ["Myself", "My child", "Another learner", "A small group"];
const learningModes = ["In person", "Online", "Hybrid"];
const preferredSchedules = ["Weekday evenings", "Weekends", "After school", "Flexible"];
const budgetRanges = ["Under £25/hr", "£25-£40/hr", "£40-£60/hr", "Flexible"];
const unselectedSteps = [
  { label: "Choose role", description: "Select how you want to use SupplyED" },
  { label: "Role details", description: "Complete the details needed for that path" },
  { label: "Verification", description: "Provide required safety or compliance details" },
  { label: "Review", description: "Confirm before submitting" },
];

function stepContent(role: SignupRole) {
  if (role === "teacher") {
    return [
      { label: "Profile basics", description: "Add contact details for your verified account" },
      { label: "Teaching profile", description: "Subjects, stages, experience, and bio" },
      { label: "Compliance", description: "DBS, right to work, and identity checks" },
      { label: "Review", description: "Confirm your teacher profile" },
    ];
  }

  if (role === "individual") {
    return [
      { label: "Your details", description: "Choose how you want to hire talent and add contact details" },
      { label: "Learner needs", description: "Subject, stage, schedule, and location preferences" },
      { label: "Safeguarding", description: "Privacy, contact, and verified teacher expectations" },
      { label: "Review", description: "Confirm the learner request before matching" },
    ];
  }

  return [
    { label: "Contact details", description: "Add contact details for your verified account" },
    { label: "School details", description: "Organisation, cover needs, and authority" },
    { label: "Compliance", description: "Safeguarding contact and approval details" },
    { label: "Review", description: "Confirm your school workspace" },
  ];
}

function roleLabel(role: SignupRole) {
  if (role === "teacher") return "Supply teacher";
  if (role === "individual") return "Individual hirer";
  return "School / MAT";
}

function signupHeroTitle(role: SignupRole) {
  if (role === "teacher") return "Build your trusted teacher profile.";
  if (role === "individual") return "Find trusted support for a learner.";
  return "Create your school staffing workspace.";
}

function signupHeroCopy(role: SignupRole) {
  if (role === "teacher") {
    return "Complete your teaching profile once, then use it for matching, messaging, bookings, and compliance checks.";
  }

  if (role === "individual") {
    return "Create a safe request, browse verified teachers, and keep every conversation under the verified hiring account.";
  }

  return "Set up a verified workspace for posting cover, reviewing ranked matches, and keeping compliance visible.";
}

function signupStepTitle(role: SignupRole, step: SignupStep) {
  if (step === 1) return "Complete profile basics";
  if (step === 2) {
    if (role === "teacher") return "Build your teacher profile";
    if (role === "individual") return "Add learner needs";
    return "Add school details";
  }
  if (step === 3) return role === "individual" ? "Set safeguarding preferences" : "Complete compliance";
  return "Review and submit";
}

function signupSubmitLabel(role: SignupRole) {
  if (role === "individual") return "Create learner request";
  return "Submit for review";
}

function fieldClass(error?: string) {
  return cn("input", error ? "border-[var(--red)] bg-[var(--red-tint)]" : null);
}

function areaClass(error?: string) {
  return cn("textarea min-h-[132px]", error ? "border-[var(--red)] bg-[var(--red-tint)]" : null);
}

function ReviewBadgeList({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-[var(--muted)]">Not selected</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className="rounded-full bg-[var(--se-tint)] px-2.5 py-1 text-xs font-semibold text-[var(--se)]">
          {item}
        </span>
      ))}
    </div>
  );
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function FileSummary({ file }: { file: UploadedFile | null }) {
  if (!file) return <span className="text-[var(--muted)]">Not uploaded</span>;

  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[var(--ink)]">
      <Icon name={file.type.startsWith("image/") ? "image" : "file"} size={13} className="text-[var(--se)]" />
      <span className="min-w-0 truncate">{file.name}</span>
      <span className="shrink-0 text-[var(--muted)]">{formatFileSize(file.size)}</span>
    </span>
  );
}

function toUploadedFile(file: File): UploadedFile {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
  };
}

function UploadCard({
  id,
  title,
  description,
  icon,
  accept,
  capture,
  file,
  error,
  actionLabel,
  onFile,
}: {
  id: string;
  title: string;
  description: string;
  icon: string;
  accept: string;
  capture?: "user" | "environment";
  file: UploadedFile | null;
  error?: string;
  actionLabel: string;
  onFile: (file: UploadedFile) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-5 transition",
        error ? "border-[var(--red)] bg-[var(--red-tint)]" : file ? "border-[var(--se)] bg-[var(--se-tint)]" : "border-[var(--border)]",
      )}
    >
      <div className="flex min-h-[132px] flex-col">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--se-tint)] text-[var(--se)]">
            <Icon name={icon} size={20} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold">{title}</div>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{description}</p>
          </div>
        </div>

        <div className="mt-auto pt-5">
          {file ? (
            <div className="mb-3">
              <FileSummary file={file} />
            </div>
          ) : null}
          <label
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full border border-[var(--border-2)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--se)] hover:bg-[var(--se-tint)] focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--se)] focus-within:ring-offset-2"
            htmlFor={id}
          >
            <Icon name={file ? "upload" : icon} size={15} />
            {file ? "Replace file" : actionLabel}
            <input
              accept={accept}
              capture={capture}
              className="sr-only"
              id={id}
              onChange={(event) => {
                const selectedFile = event.target.files?.[0];
                if (!selectedFile) return;
                onFile(toUploadedFile(selectedFile));
                event.target.value = "";
              }}
              type="file"
            />
          </label>
          {error ? <div className="mt-2 text-xs font-semibold text-[var(--red)]">{error}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function OnboardingPage({
  accountEmail,
  headerActionLabel = "Log in",
  headerPrompt = "Already registered?",
  roleSelected,
  step,
  setStep,
  role,
  setRole,
  onFinish,
  onLanding,
  onLogin,
}: {
  accountEmail?: string;
  headerActionLabel?: string;
  headerPrompt?: string;
  roleSelected: boolean;
  step: number;
  setStep: (step: number) => void;
  role: AppRole;
  setRole: (role: SignupRole) => void;
  onFinish: () => void;
  onLanding: () => void;
  onLogin: () => void;
}) {
  const activeRole: SignupRole = role === "teacher" ? "teacher" : role === "individual" ? "individual" : "institution";
  const currentStep = Math.min(4, Math.max(1, step)) as SignupStep;
  const steps = useMemo(() => (roleSelected ? stepContent(activeRole) : unselectedSteps), [activeRole, roleSelected]);
  const [form, setForm] = useState<SignupForm>(() => ({ ...initialForm, email: accountEmail || "" }));
  const [errors, setErrors] = useState<SignupErrors>({});
  const progress = currentStep * 25;
  const reviewGroups = useMemo<ReviewGroup[]>(() => {
    const accountLines: ReviewLine[] = [
      { label: "Account type", value: roleLabel(activeRole) },
      { label: "Name", value: form.fullName || "Not provided" },
      { label: "Email", value: form.email || accountEmail || "Not provided" },
      { label: "Phone", value: form.phone || "Not provided" },
      { label: "Postcode", value: form.postcode || "Not provided" },
    ];

    if (activeRole === "teacher") {
      return [
        {
          title: "Account",
          description: "Login and contact details",
          icon: "user",
          editStep: 1,
          lines: accountLines,
        },
        {
          title: "Teaching Profile",
          description: "Subjects, stages, and classroom fit",
          icon: "award",
          editStep: 2,
          lines: [
            { label: "Subjects", value: <ReviewBadgeList items={form.subjects} />, wide: true },
            { label: "Key stages", value: <ReviewBadgeList items={form.keyStages} />, wide: true },
            { label: "Experience", value: form.yearsExperience ? `${form.yearsExperience} years` : "Not provided" },
            { label: "TRN", value: form.teachingReferenceNumber || "Optional" },
            { label: "Bio", value: form.bio || "Not provided", wide: true },
          ],
        },
        {
          title: "Compliance",
          description: "Verification readiness",
          icon: "shield",
          editStep: 3,
          lines: [
            { label: "DBS certificate", value: form.dbsNumber || "Not provided" },
            { label: "Right-to-work document", value: <FileSummary file={form.rightToWorkFile} />, wide: true },
            { label: "Photo ID picture", value: <FileSummary file={form.identityPhoto} />, wide: true },
          ],
        },
      ];
    }

    if (activeRole === "individual") {
      return [
        {
          title: "Account",
          description: "Login and contact details",
          icon: "user",
          editStep: 1,
          lines: accountLines,
        },
        {
          title: "Learner Request",
          description: "Subject, stage, and scheduling needs",
          icon: "heart",
          editStep: 2,
          lines: [
            { label: "Support for", value: form.individualRelationship || "Not provided" },
            { label: "Subjects", value: <ReviewBadgeList items={form.subjects} />, wide: true },
            { label: "Stage", value: <ReviewBadgeList items={form.keyStages} />, wide: true },
            { label: "Format", value: form.learningMode || "Not provided" },
            { label: "Schedule", value: form.preferredSchedule || "Not provided" },
            { label: "Budget", value: form.budgetRange || "Not provided" },
            { label: "Notes", value: form.learnerNotes || "Optional", wide: true },
          ],
        },
        {
          title: "Safeguarding",
          description: "Privacy and verified-teacher expectations",
          icon: "shield",
          editStep: 3,
          lines: [
            { label: "Hiring consent", value: form.individualConsent ? "Hiring responsibility confirmed" : "Not confirmed", wide: true },
            { label: "Platform safety", value: form.safeguardingConfirmed ? "Messaging and bookings stay inside SupplyED" : "Not confirmed", wide: true },
          ],
        },
      ];
    }

    return [
      {
        title: "Account",
        description: "Login and contact details",
        icon: "user",
        editStep: 1,
        lines: accountLines,
      },
      {
        title: "School Workspace",
        description: "Organisation and staffing needs",
        icon: "building",
        editStep: 2,
        lines: [
          { label: "School / MAT", value: form.schoolName || "Not provided" },
          { label: "Your role", value: form.contactRole || "Not provided" },
          { label: "Region", value: form.localAuthority || "Not provided" },
          { label: "Pupil count", value: form.yearsExperience || "Optional" },
          { label: "Needs", value: <ReviewBadgeList items={form.coverTypes} />, wide: true },
        ],
      },
      {
        title: "Compliance",
        description: "Safeguarding approval",
        icon: "shield",
        editStep: 3,
        lines: [
          { label: "Compliance lead", value: form.complianceContact || "Not provided" },
          { label: "Compliance email", value: form.complianceEmail || "Not provided" },
          { label: "Safeguarding", value: form.safeguardingConfirmed ? "Authorised staff confirmed" : "Not confirmed" },
        ],
      },
    ];
  }, [accountEmail, activeRole, form]);

  function updateField<FieldName extends keyof SignupForm>(field: FieldName, value: SignupForm[FieldName]) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validateStep(targetStep: SignupStep) {
    const nextErrors: SignupErrors = {};

    if (targetStep === 1) {
      if (!roleSelected) nextErrors.accountRole = "Choose how you want to use SupplyED.";
      if (!form.fullName.trim()) nextErrors.fullName = "Enter your full name.";
      if (!form.phone.trim()) nextErrors.phone = "Enter a contact number.";
      else if (!phonePattern.test(form.phone.trim())) nextErrors.phone = "Use a valid phone number.";
      if (!form.postcode.trim()) nextErrors.postcode = "Enter your postcode.";
    }

    if (targetStep === 2 && activeRole === "institution") {
      if (!form.schoolName.trim()) nextErrors.schoolName = "Enter the school or MAT name.";
      if (!form.contactRole.trim()) nextErrors.contactRole = "Enter your role.";
      if (!form.localAuthority.trim()) nextErrors.localAuthority = "Enter the local authority or region.";
      if (form.coverTypes.length === 0) nextErrors.coverTypes = "Choose at least one staffing need.";
    }

    if (targetStep === 2 && activeRole === "teacher") {
      if (form.subjects.length === 0) nextErrors.subjects = "Choose at least one subject.";
      if (form.keyStages.length === 0) nextErrors.keyStages = "Choose at least one key stage.";
      if (!form.yearsExperience.trim()) nextErrors.yearsExperience = "Enter your years of experience.";
      else if (Number(form.yearsExperience) < 0) nextErrors.yearsExperience = "Experience cannot be negative.";
      if (form.bio.trim().length < 40) nextErrors.bio = "Write at least 40 characters so schools understand your teaching style.";
    }

    if (targetStep === 2 && activeRole === "individual") {
      if (!form.individualRelationship) nextErrors.individualRelationship = "Choose who needs support.";
      if (form.subjects.length === 0) nextErrors.subjects = "Choose at least one subject.";
      if (form.keyStages.length === 0) nextErrors.keyStages = "Choose the learner stage.";
      if (!form.learningMode) nextErrors.learningMode = "Choose online, in-person, or hybrid support.";
      if (!form.preferredSchedule) nextErrors.preferredSchedule = "Choose a preferred schedule.";
      if (!form.budgetRange) nextErrors.budgetRange = "Choose a budget range.";
    }

    if (targetStep === 3 && activeRole === "institution") {
      if (!form.complianceContact.trim()) nextErrors.complianceContact = "Enter the safeguarding or compliance lead.";
      if (!form.complianceEmail.trim()) nextErrors.complianceEmail = "Enter the compliance email.";
      else if (!emailPattern.test(form.complianceEmail.trim())) nextErrors.complianceEmail = "Use a valid email address.";
      if (!form.safeguardingConfirmed) nextErrors.safeguardingConfirmed = "Confirm safeguarding responsibility.";
    }

    if (targetStep === 3 && activeRole === "teacher") {
      if (!form.dbsNumber.trim()) nextErrors.dbsNumber = "Enter your enhanced DBS certificate number.";
      if (!form.rightToWorkFile) nextErrors.rightToWorkFile = "Upload your right-to-work evidence.";
      if (!form.identityPhoto) nextErrors.identityPhoto = "Upload or capture a photo of your ID.";
    }

    if (targetStep === 3 && activeRole === "individual") {
      if (!form.individualConsent) nextErrors.individualConsent = "Confirm you are authorised to arrange learning support.";
      if (!form.safeguardingConfirmed) nextErrors.safeguardingConfirmed = "Confirm communication will stay inside SupplyED.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function continueStep() {
    if (!validateStep(currentStep)) return;
    setStep(currentStep + 1);
    setErrors({});
  }

  function submitSignup() {
    for (const targetStep of [1, 2, 3] as SignupStep[]) {
      if (!validateStep(targetStep)) {
        setStep(targetStep);
        return;
      }
    }

    onFinish();
  }

  function renderReviewCard(group: ReviewGroup, featured = false) {
    return (
      <section key={group.title} className={cn("min-w-0 rounded-xl border border-[var(--border)] bg-white", featured ? "p-5" : "p-4")}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--se-tint)] text-[var(--se)]">
              <Icon name={group.icon} size={19} />
            </div>
            <div className="min-w-0">
              <h3 className="font-serif text-xl leading-tight">{group.title}</h3>
              <p className="mt-1 text-sm leading-5 text-[var(--muted)]">{group.description}</p>
            </div>
          </div>
          <button
            className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-[var(--se)] transition hover:bg-[var(--se-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--se)] focus-visible:ring-offset-2"
            onClick={() => setStep(group.editStep)}
            type="button"
          >
            Edit
          </button>
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {group.lines.map((line) => (
            <div
              key={line.label}
              className={cn("min-w-0 rounded-lg bg-[var(--chalk)] px-3.5 py-3", line.wide && featured ? "sm:col-span-2" : null)}
            >
              <div className="mb-1 text-[10px] font-bold uppercase tracking-[1px] text-[var(--muted)]">{line.label}</div>
              <div className="min-w-0 break-words text-sm leading-6 text-[var(--ink)]">{line.value}</div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--chalk)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-white px-4 py-4 sm:px-6 lg:px-8">
        <Logo size={21} onClick={onLanding} />
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-[var(--muted)] sm:inline">{headerPrompt}</span>
          <Btn variant="secondary" size="sm" onClick={onLogin}>{headerActionLabel}</Btn>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-73px)] max-w-[1240px] grid-cols-1 px-4 py-5 sm:px-6 sm:py-8 lg:grid-cols-[380px_1fr] lg:items-stretch lg:px-8">
        <aside className="relative overflow-hidden rounded-t-xl bg-[#0a0a0a] p-6 text-white shadow-[var(--shadow-lg)] sm:p-8 lg:rounded-l-xl lg:rounded-r-none">
          <div className="absolute inset-0 bg-[linear-gradient(rgb(var(--se-rgb)/0.08)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--se-rgb)/0.08)_1px,transparent_1px)] bg-[length:48px_48px]" />
          <div className="relative flex h-full flex-col">
            <div>
              <div className="eyebrow mb-5 text-[var(--se)]">Join SupplyED</div>
              <h1 className="font-serif text-3xl leading-[1.08] sm:text-[40px]">
                {roleSelected ? signupHeroTitle(activeRole) : "Choose your SupplyED path."}
              </h1>
              <p className="mt-5 text-sm leading-7 text-white/65 sm:text-[15px]">
                {roleSelected
                  ? signupHeroCopy(activeRole)
                  : "Your email is verified. Now choose whether you are hiring talent, joining as a teacher, or setting up a school workspace."}
              </p>
            </div>

            <div className="mt-8 space-y-4">
              {steps.map((item, index) => {
                const itemStep = index + 1;
                const active = itemStep === currentStep;
                const complete = itemStep < currentStep;

                return (
                  <button
                    key={item.label}
                    className="flex w-full gap-3 text-left"
                    onClick={() => {
                      if (itemStep < currentStep) setStep(itemStep);
                    }}
                    type="button"
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold"
                      style={{
                        background: complete ? "var(--se)" : active ? "#fff" : "transparent",
                        borderColor: complete || active ? "var(--se)" : "rgba(255,255,255,0.25)",
                        color: complete ? "#fff" : active ? "var(--ink)" : "rgba(255,255,255,0.55)",
                      }}
                    >
                      {complete ? <Icon name="check" size={14} /> : itemStep}
                    </span>
                    <span>
                      <span className={active ? "block font-semibold text-white" : "block font-medium text-white/70"}>{item.label}</span>
                      <span className="block text-xs text-white/45">{item.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-auto hidden rounded-lg border border-white/10 bg-white/5 p-4 lg:block">
              <div className="text-xs uppercase tracking-[1px] text-white/45">Current path</div>
              <div className="mt-1 font-serif text-2xl">{roleSelected ? roleLabel(activeRole) : "Role selection"}</div>
              <p className="mt-1 text-sm text-white/55">You can change this in the account step before submitting.</p>
            </div>
          </div>
        </aside>

        <section className="flex min-h-[680px] flex-col rounded-b-xl border border-t-0 border-[var(--border)] bg-white p-5 shadow-[var(--shadow-xs)] sm:p-8 lg:rounded-l-none lg:rounded-r-xl lg:border-l-0 lg:border-t">
          <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
            <div>
              <Tag>Step {currentStep} of 4</Tag>
              <h2 className="mt-3 font-serif text-3xl leading-tight sm:text-[36px]">
                {roleSelected ? signupStepTitle(activeRole, currentStep) : "Choose account type"}
              </h2>
              <p className="mt-2 max-w-[640px] text-[var(--muted)]">{steps[currentStep - 1].description}</p>
            </div>
            <div className="w-full sm:w-[210px]">
              <div className="mb-2 flex justify-between text-xs font-semibold uppercase tracking-[1px] text-[var(--muted)]">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="progress">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

          <div className="flex-1">
            {currentStep === 1 ? (
              <div className="space-y-6">
                <div className="rounded-xl border border-[var(--se-tint-2)] bg-[var(--se-tint)] p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--se)]">
                      <Icon name="checkCircle" size={19} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-[var(--se-dark)]">Account verified</div>
                      <div className="truncate text-sm text-[var(--se-dark)]/75">{form.email || accountEmail || "Verified email"}</div>
                    </div>
                  </div>
                </div>

                <Field label="Choose account type" error={errors.accountRole} required>
                  <div className="grid gap-3 lg:grid-cols-3">
                    {([
                      ["institution", "School / MAT", "building", "Post roles, review ranked matches, and manage compliance."],
                      ["teacher", "Supply teacher", "user", "Build your profile, find roles, and manage availability."],
                      ["individual", "Individual hirer", "heart", "Find verified teachers for yourself, your child, or another learner."],
                    ] as const).map(([value, title, icon, copy]) => {
                      const selected = roleSelected && activeRole === value;

                      return (
                        <button
                          key={value}
                          aria-pressed={selected}
                          className="rounded-xl border p-4 text-left transition hover:border-[var(--se)] hover:bg-[var(--se-tint)] sm:p-5"
                          onClick={() => {
                            setRole(value);
                            setErrors((current) => ({ ...current, accountRole: undefined }));
                          }}
                          style={{ borderColor: selected ? "var(--se)" : "var(--border)", background: selected ? "var(--se-tint)" : "#fff" }}
                          type="button"
                        >
                          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-white text-[var(--se)]">
                            <Icon name={icon} size={20} />
                          </div>
                          <div className="font-serif text-xl">{title}</div>
                          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{copy}</p>
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <div className="grid gap-x-4 sm:grid-cols-2">
                  <Field label="Full name" htmlFor="signup-name" error={errors.fullName} required>
                    <input id="signup-name" className={fieldClass(errors.fullName)} value={form.fullName} onChange={(event) => updateField("fullName", event.target.value)} placeholder="Your full name" />
                  </Field>
                  <Field label="Phone" htmlFor="signup-phone" error={errors.phone} required>
                    <input id="signup-phone" className={fieldClass(errors.phone)} value={form.phone} onChange={(event) => updateField("phone", event.target.value)} placeholder="+44 7700 900000" inputMode="tel" />
                  </Field>
                  <Field label="Postcode" htmlFor="signup-postcode" error={errors.postcode} required>
                    <input id="signup-postcode" className={fieldClass(errors.postcode)} value={form.postcode} onChange={(event) => updateField("postcode", event.target.value.toUpperCase())} placeholder="M1 1AE" />
                  </Field>
                </div>
              </div>
            ) : null}

            {currentStep === 2 && activeRole === "institution" ? (
              <div className="space-y-6">
                <div className="grid gap-x-4 sm:grid-cols-2">
                  <Field label="School or MAT name" htmlFor="school-name" error={errors.schoolName} required>
                    <input id="school-name" className={fieldClass(errors.schoolName)} value={form.schoolName} onChange={(event) => updateField("schoolName", event.target.value)} placeholder="Greenfield Primary School" />
                  </Field>
                  <Field label="Your role" htmlFor="contact-role" error={errors.contactRole} required>
                    <input id="contact-role" className={fieldClass(errors.contactRole)} value={form.contactRole} onChange={(event) => updateField("contactRole", event.target.value)} placeholder="Headteacher, HR lead, cover manager" />
                  </Field>
                  <Field label="Local authority / region" htmlFor="authority" error={errors.localAuthority} required>
                    <input id="authority" className={fieldClass(errors.localAuthority)} value={form.localAuthority} onChange={(event) => updateField("localAuthority", event.target.value)} placeholder="Greater Manchester" />
                  </Field>
                  <Field label="Typical pupil count" htmlFor="pupils" hint="Optional, helps estimate staffing needs.">
                    <input id="pupils" className="input" value={form.yearsExperience} onChange={(event) => updateField("yearsExperience", event.target.value.replace(/\D/g, ""))} placeholder="420" inputMode="numeric" />
                  </Field>
                </div>
                <Field label="Staffing needs" error={errors.coverTypes} required>
                  <MultiSelectDropdown
                    error={Boolean(errors.coverTypes)}
                    options={coverTypes}
                    placeholder="Select staffing needs"
                    value={form.coverTypes}
                    onChange={(value) => updateField("coverTypes", value)}
                  />
                </Field>
              </div>
            ) : null}

            {currentStep === 2 && activeRole === "teacher" ? (
              <div className="space-y-6">
                <Field label="Primary subjects" error={errors.subjects} required>
                  <MultiSelectDropdown
                    error={Boolean(errors.subjects)}
                    options={subjects}
                    placeholder="Select primary subjects"
                    value={form.subjects}
                    onChange={(value) => updateField("subjects", value)}
                  />
                </Field>
                <Field label="Key stages" error={errors.keyStages} required>
                  <MultiSelectDropdown
                    error={Boolean(errors.keyStages)}
                    options={keyStages}
                    placeholder="Select key stages"
                    value={form.keyStages}
                    onChange={(value) => updateField("keyStages", value)}
                  />
                </Field>
                <div className="grid gap-x-4 sm:grid-cols-2">
                  <Field label="Years of experience" htmlFor="experience" error={errors.yearsExperience} required>
                    <input id="experience" className={fieldClass(errors.yearsExperience)} value={form.yearsExperience} onChange={(event) => updateField("yearsExperience", event.target.value.replace(/[^\d.]/g, ""))} placeholder="5" inputMode="decimal" />
                  </Field>
                  <Field label="Teaching reference number" htmlFor="trn" hint="Optional for now.">
                    <input id="trn" className="input" value={form.teachingReferenceNumber} onChange={(event) => updateField("teachingReferenceNumber", event.target.value)} placeholder="TRN number" />
                  </Field>
                </div>
                <Field label="Teaching bio" htmlFor="bio" error={errors.bio} required>
                  <textarea
                    id="bio"
                    className={areaClass(errors.bio)}
                    value={form.bio}
                    onChange={(event) => updateField("bio", event.target.value)}
                    placeholder="Describe your classroom style, specialist subjects, behaviour approach, and availability."
                  />
                </Field>
              </div>
            ) : null}

            {currentStep === 2 && activeRole === "individual" ? (
              <div className="space-y-6">
                <Field label="Who needs support?" error={errors.individualRelationship} required>
                  <SelectDropdown
                    error={Boolean(errors.individualRelationship)}
                    options={supportForOptions}
                    placeholder="Select who needs support"
                    value={form.individualRelationship}
                    onChange={(value) => updateField("individualRelationship", value)}
                  />
                </Field>

                <div className="grid gap-6 xl:grid-cols-2">
                  <Field label="Subject needed" error={errors.subjects} required>
                    <MultiSelectDropdown
                      error={Boolean(errors.subjects)}
                      options={subjects}
                      placeholder="Select subject needs"
                      value={form.subjects}
                      onChange={(value) => updateField("subjects", value)}
                    />
                  </Field>
                  <Field label="Learner stage" error={errors.keyStages} required>
                    <SelectDropdown
                      error={Boolean(errors.keyStages)}
                      options={keyStages}
                      placeholder="Select learner stage"
                      value={form.keyStages[0] || ""}
                      onChange={(value) => updateField("keyStages", value ? [value] : [])}
                    />
                  </Field>
                </div>

                <div className="grid gap-6 xl:grid-cols-3">
                  <Field label="Format" error={errors.learningMode} required>
                    <SelectDropdown
                      error={Boolean(errors.learningMode)}
                      options={learningModes}
                      placeholder="Select format"
                      value={form.learningMode}
                      onChange={(value) => updateField("learningMode", value)}
                    />
                  </Field>
                  <Field label="Preferred schedule" error={errors.preferredSchedule} required>
                    <SelectDropdown
                      error={Boolean(errors.preferredSchedule)}
                      options={preferredSchedules}
                      placeholder="Select schedule"
                      value={form.preferredSchedule}
                      onChange={(value) => updateField("preferredSchedule", value)}
                    />
                  </Field>
                  <Field label="Budget range" error={errors.budgetRange} required>
                    <SelectDropdown
                      error={Boolean(errors.budgetRange)}
                      options={budgetRanges}
                      placeholder="Select budget range"
                      value={form.budgetRange}
                      onChange={(value) => updateField("budgetRange", value)}
                    />
                  </Field>
                </div>

                <Field label="Learner notes" htmlFor="learner-notes" hint="Optional. Avoid sharing full child identity at signup.">
                  <textarea
                    id="learner-notes"
                    className="textarea min-h-[116px]"
                    value={form.learnerNotes}
                    onChange={(event) => updateField("learnerNotes", event.target.value)}
                    placeholder="Example: Year 5 learner needs confidence with fractions. Prefer calm, structured sessions after school."
                  />
                </Field>
              </div>
            ) : null}

            {currentStep === 3 && activeRole === "institution" ? (
              <div className="space-y-6">
                <div className="grid gap-x-4 sm:grid-cols-2">
                  <Field label="Compliance lead" htmlFor="compliance-contact" error={errors.complianceContact} required>
                    <input id="compliance-contact" className={fieldClass(errors.complianceContact)} value={form.complianceContact} onChange={(event) => updateField("complianceContact", event.target.value)} placeholder="Name of safeguarding lead" />
                  </Field>
                  <Field label="Compliance email" htmlFor="compliance-email" error={errors.complianceEmail} required>
                    <input id="compliance-email" className={fieldClass(errors.complianceEmail)} value={form.complianceEmail} onChange={(event) => updateField("complianceEmail", event.target.value)} placeholder="safeguarding@school.org.uk" type="email" />
                  </Field>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--chalk)] p-5">
                  <div className="mb-3 flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--se)]">
                      <Icon name="shield" size={19} />
                    </div>
                    <div>
                      <div className="font-semibold">Safeguarding responsibility</div>
                      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">SupplyED can verify teacher documents, but schools remain responsible for local safeguarding and booking approvals.</p>
                    </div>
                  </div>
                  <Field error={errors.safeguardingConfirmed}>
                    <Checkbox checked={form.safeguardingConfirmed} onChange={(value) => updateField("safeguardingConfirmed", value)} label="I confirm this workspace will be managed by authorised school staff." />
                  </Field>
                </div>
              </div>
            ) : null}

            {currentStep === 3 && activeRole === "individual" ? (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--chalk)] p-5">
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-white text-[var(--se)]">
                      <Icon name="shield" size={20} />
                    </div>
                    <div className="font-semibold">Verified teacher access</div>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      Hirers see verification badges, while documents stay private for admin review and safeguarding checks.
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--chalk)] p-5">
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-white text-[var(--se)]">
                      <Icon name="message" size={20} />
                    </div>
                    <div className="font-semibold">Account-led communication</div>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                      Requests, messages, bookings, and location details should stay under the adult account.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-white p-5">
                  <div className="space-y-4">
                    <Field error={errors.individualConsent}>
                      <Checkbox
                        checked={form.individualConsent}
                        onChange={(value) => updateField("individualConsent", value)}
                        label="I confirm I am authorised to arrange this learning support."
                      />
                    </Field>
                    <Field error={errors.safeguardingConfirmed}>
                      <Checkbox
                        checked={form.safeguardingConfirmed}
                        onChange={(value) => updateField("safeguardingConfirmed", value)}
                        label="I understand direct contact, messaging, and bookings should remain inside SupplyED."
                      />
                    </Field>
                  </div>
                </div>
              </div>
            ) : null}

            {currentStep === 3 && activeRole === "teacher" ? (
              <div className="space-y-6">
                <Field label="Enhanced DBS certificate number" htmlFor="dbs-number" error={errors.dbsNumber} required>
                  <input id="dbs-number" className={fieldClass(errors.dbsNumber)} value={form.dbsNumber} onChange={(event) => updateField("dbsNumber", event.target.value)} placeholder="Certificate number" />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <UploadCard
                    id="right-to-work-file"
                    title="Right-to-work evidence"
                    description="Upload the exact document you will use for verification, such as passport, share-code proof, or visa evidence."
                    icon="file"
                    accept=".pdf,.png,.jpg,.jpeg,.heic,.webp"
                    file={form.rightToWorkFile}
                    error={errors.rightToWorkFile}
                    actionLabel="Upload document"
                    onFile={(file) => updateField("rightToWorkFile", file)}
                  />
                  <UploadCard
                    id="identity-photo"
                    title="Photo ID picture"
                    description="Take or upload a clear picture of your photo ID. Use the full document, not a cropped corner."
                    icon="image"
                    accept="image/*"
                    capture="environment"
                    file={form.identityPhoto}
                    error={errors.identityPhoto}
                    actionLabel="Take picture"
                    onFile={(file) => updateField("identityPhoto", file)}
                  />
                </div>
              </div>
            ) : null}

            {currentStep === 4 ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-[var(--se-tint-2)] bg-[var(--se-tint)] p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--se)]">
                      <Icon name="checkCircle" size={20} />
                    </div>
                    <div>
                      <div className="font-semibold text-[var(--se-dark)]">Ready to submit</div>
                      <p className="mt-1 text-sm leading-6 text-[var(--se-dark)]/80">
                        Review the details below. Each section can be edited without losing the information you already entered.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="space-y-4">
                    {reviewGroups[0] ? renderReviewCard(reviewGroups[0]) : null}
                    {reviewGroups[2] ? renderReviewCard(reviewGroups[2]) : null}
                  </div>
                  {reviewGroups[1] ? renderReviewCard(reviewGroups[1], true) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-[var(--border)] pt-6 sm:flex-row sm:items-center sm:justify-between">
            <Btn variant="ghost" disabled={currentStep === 1} onClick={() => setStep(Math.max(1, currentStep - 1))}>Back</Btn>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Btn variant="secondary" onClick={onLanding}>Save and exit</Btn>
              <Btn size="lg" iconRight="arrow" onClick={() => (currentStep === 4 ? submitSignup() : continueStep())}>
                {currentStep === 4 ? signupSubmitLabel(activeRole) : "Continue"}
              </Btn>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
