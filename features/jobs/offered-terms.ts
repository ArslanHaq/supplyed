import type { JobPayType, JobSchedule, PaymentFrequency } from "@/types/supplyed";

/** The server's immutable offer. Never populate missing fields from a live job. */
export type OfferedJobTerms = {
  id: string;
  title: string;
  description: string;
  subject: string | null;
  subjects: string[];
  requiredSkills: string[];
  minExperienceYears: number | null;
  keyStages: string[];
  address: string | null;
  city: string | null;
  county: string | null;
  postalCode: string | null;
  countryCode: string;
  latitude: number | null;
  longitude: number | null;
  parkingInfo: string | null;
  startDate: string | null;
  endDate: string | null;
  payAmount: number | null;
  payType: JobPayType | null;
  currency: string;
  paymentFrequency: PaymentFrequency | null;
  periodAnchor: "ASSIGNMENT_START" | "CALENDAR";
  timeZone: string;
  schedule: JobSchedule | null;
  workersRequired: number;
  scheduledMinutes: number | null;
  hours: number | null;
  days: number | null;
};
