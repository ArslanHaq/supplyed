export type DropdownOption = {
  key: string; value: string; label: string; aliases: string[]; group: string | null;
  sortOrder: number; isActive: boolean; isShared: boolean; subjectKeys: string[];
  schoolTypes?: import("@/types/supplyed").SchoolType[];
  primarySubjectKeys?: string[];
  secondarySubjectKeys?: string[];
};
export type DropdownSummary = {
  id: string; name: string; label: string; revision: number; isActive: boolean;
  updatedAt: string; expandable: boolean; optionCount: number;
};
export type Dropdown = Omit<DropdownSummary, "optionCount"> & { options: DropdownOption[] };
export type DropdownName = "subject" | "skill" | "keyStage" | "country" | "city" | "region" | "currency" | "institutionType" | "schoolType" | "coverType" | "payType" | "timezone" | "waitlistSchoolRole" | "waitlistSchoolArea" | "waitlistSchoolType" | "supplyDaysPerTerm" | "coverBookingMethod" | "waitlistTeacherRole" | "waitlistTeacherArea" | "currentSupply" | "daysPerWeek" | "waitlistPhase" | "discoveryUrgency" | "teacherRating" | "bookingInvoiceState" | "refundReason" | "applicationStatus" | "jobStatus" | "jobInvitationStatus" | "bookingStatus" | "invoiceStatus" | "profileStatus" | "foundingInterestStatus" | "documentVerificationStatus" | "signatoryApprovalStatus" | "proposalFontFamily" | "proposalFontSize" | "proposalTextColor" | "descriptionFontSize" | "themeAccent" | "legacySchoolRole" | "legacySchoolType" | "legacySchoolTier" | "legacyTeacherRole" | "legacyTeacherPhase" | "availability";

const editorColourNames: Record<string, string> = {
  "#17211c": "Charcoal",
  "#227557": "Green",
  "#315ca8": "Blue",
  "#7a4a9e": "Purple",
  "#a1483f": "Red",
};

export const dropdownOptions = (data?: Dropdown) => (data?.options ?? []).filter(option => option.isActive).map(option => ({
  label: data?.name === "proposalTextColor" && /^#[0-9a-f]{3,8}$/i.test(option.label.trim())
    ? editorColourNames[option.value.trim().toLowerCase()] ?? option.label
    : option.label,
  value: option.value, group: option.group ?? undefined, keywords: option.aliases.join(" "),
}));
