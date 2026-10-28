export type DropdownOption = {
  key: string; value: string; label: string; aliases: string[]; group: string | null;
  sortOrder: number; isActive: boolean; isShared: boolean; subjectKeys: string[];
};
export type DropdownSummary = {
  id: string; name: string; label: string; revision: number; isActive: boolean;
  updatedAt: string; expandable: boolean; optionCount: number;
};
export type Dropdown = Omit<DropdownSummary, "optionCount"> & { options: DropdownOption[] };
export type DropdownName = "subject" | "skill" | "keyStage" | "country" | "city" | "region" | "currency" | "institutionType" | "coverType" | "payType" | "timezone" | "waitlistSchoolRole" | "waitlistSchoolArea" | "waitlistSchoolType" | "supplyDaysPerTerm" | "coverBookingMethod" | "waitlistTeacherRole" | "waitlistTeacherArea" | "currentSupply" | "daysPerWeek" | "waitlistPhase" | "discoveryUrgency" | "teacherRating" | "bookingInvoiceState" | "refundReason" | "applicationStatus" | "jobStatus" | "jobInvitationStatus" | "bookingStatus" | "invoiceStatus" | "profileStatus" | "foundingInterestStatus" | "documentVerificationStatus" | "signatoryApprovalStatus" | "proposalFontFamily" | "proposalFontSize" | "proposalTextColor" | "descriptionFontSize" | "themeAccent" | "legacySchoolRole" | "legacySchoolType" | "legacySchoolTier" | "legacyTeacherRole" | "legacyTeacherPhase" | "availability";

export const dropdownOptions = (data?: Dropdown) => (data?.options ?? []).filter(option => option.isActive).map(option => ({
  label: option.label, value: option.value, group: option.group ?? undefined, keywords: option.aliases.join(" "),
}));
