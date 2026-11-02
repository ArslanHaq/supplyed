import type { JobSchedule } from "@/types/supplyed";

export type TeacherAvailability = {
  id?: string;
  instructorId?: string;
  timeZone: string;
  weeklySchedule: Pick<JobSchedule, "weekdays">;
  exceptions: NonNullable<JobSchedule["exceptions"]>;
  version?: number;
  updatedAt?: string;
};

export type AvailabilityBooking = {
  id: string;
  startDate: string | null;
  endDate: string | null;
  timeZone: string;
  schedule: JobSchedule | null;
  job: { title: string };
};

export type AvailabilitySnapshot = { availability: TeacherAvailability | null; bookings: AvailabilityBooking[] };
export type ScheduleConflict = {
  date: string;
  start: string;
  end: string;
  type: "OUTSIDE_AVAILABILITY" | "BOOKING_CONFLICT";
  conflictingStart?: string;
  conflictingEnd?: string;
  bookingTitle?: string;
};
export type JobAvailabilityCheck = {
  available: boolean;
  conflicts: ScheduleConflict[];
};
