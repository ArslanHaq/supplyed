import type { Job, JobCreateInput } from "@/features/jobs/types";
import { listingCalendarInstant } from "@/features/jobs/listing-window";
import { validateJobInput, validatePublishableTerms } from "@/features/jobs/validation";
import type { InvitationInput } from "./types";
import { validateJobDateOrder, validJobDate } from "@/features/jobs/date-validation";
import { validateWorkUnits } from "@/features/jobs/work-units";

export function jobInvitationProblem(job: Job, now = Date.now()): string | null {
  if (job.status !== "DRAFT" && job.status !== "ACTIVE") return "This job is no longer available for hiring.";
  if (job.expiresAt && Date.parse(job.expiresAt) <= now) return "This job has expired. Update its expiry before hiring.";
  if (!job.startDate || !job.endDate || !Number.isFinite(Date.parse(job.startDate)) || !Number.isFinite(Date.parse(job.endDate))) return "Add start and end dates before hiring.";
  if (Date.parse(job.startDate) > Date.parse(job.endDate)) return "Correct the job's start and end dates.";
  const termsErrors = { ...validateJobDateOrder(job), ...validateWorkUnits(job) };
  if (Object.keys(termsErrors).length) return Object.values(termsErrors)[0];
  if (Date.parse(job.startDate) <= now) return "Choose a job with a future start date.";
  if (!(Number(job.payAmount) > 0) || !["hourly", "daily", "fixed"].includes(job.payType ?? "")) return "Add a positive pay amount and pay type before hiring.";
  const publishErrors = validatePublishableTerms({ ...job, description: job.description ?? "", payType: job.payType as JobCreateInput["payType"], startDate: job.startDate ?? undefined, endDate: job.endDate ?? undefined } as Partial<JobCreateInput>, now);
  return Object.values(publishErrors)[0] ?? null;
}

export function validateInvitation(input: InvitationInput, options: { fresh?: boolean; now?: number; job?: { startDate?: string | null; expiresAt?: string | null } } = {}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input && Object.keys(input).some(key => !["requestId", "instructorId", "jobId", "newJob", "message", "expiresAt"].includes(key))) errors.request = "Only invitation details can be submitted.";
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!input || !uuid.test(input.requestId)) errors.requestId = "Start a new hiring request.";
  if (!input || typeof input.instructorId !== "string" || !uuid.test(input.instructorId)) errors.instructorId = "Choose a valid teacher profile.";
  if (!input || Boolean(input.jobId) === Boolean(input.newJob)) return { ...errors, jobId: "Choose an existing job or create a new job." };
  if (input.jobId !== undefined && (typeof input.jobId !== "string" || !uuid.test(input.jobId))) errors.jobId = "Choose a valid job.";
  if (input.message !== undefined && (typeof input.message !== "string" || input.message.length > 1000)) errors.message = "Use 1,000 characters or fewer.";
  if (input.expiresAt !== undefined && (typeof input.expiresAt !== "string" || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(input.expiresAt) || !Number.isFinite(Date.parse(input.expiresAt)))) errors.expiresAt = "Enter a valid invitation deadline with a timezone.";
  if (input.newJob) {
    const jobErrors = { ...validateJobInput(input.newJob), ...validatePublishableTerms(input.newJob, options.fresh ? options.now ?? Date.now() : -Infinity) };
    if (jobErrors.expiresAt) {
      errors.listingExpiresAt = jobErrors.expiresAt;
      delete jobErrors.expiresAt;
    }
    Object.assign(errors, jobErrors);
    // A successful request may be recovered later; the backend checks eligibility after idempotency.
    if (errors.startDate === "Start date cannot be before today.") delete errors.startDate;
    if (errors.listingExpiresAt === "Listing expiry cannot be before today.") delete errors.listingExpiresAt;
    for (const field of ["startDate", "endDate"] as const) {
      const value = input.newJob[field];
      if (!value || !validJobDate(value)) errors[field] = "Enter a valid date, or a date and time with a timezone.";
    }
    if (!(typeof input.newJob.payAmount === "number" && Number.isFinite(input.newJob.payAmount) && input.newJob.payAmount > 0)) errors.payAmount = "Enter a pay amount greater than zero.";
    if (!input.newJob.payType || !["hourly", "daily", "fixed"].includes(input.newJob.payType)) errors.payType = "Choose a pay type.";
    if ((input.newJob.latitude === undefined) !== (input.newJob.longitude === undefined)) errors.latitude = "Provide both map coordinates.";
    if (input.newJob.status !== undefined) errors.status = "New invitation jobs are created as private drafts.";
  }
  if (options.fresh) {
    const now = options.now ?? Date.now();
    const job = input.newJob ?? options.job;
    if (job?.startDate && Date.parse(job.startDate) <= now) errors.startDate = "Choose a future start date and time.";
    if (input.expiresAt && !errors.expiresAt) {
      const deadline = Date.parse(input.expiresAt);
      if (deadline <= now) errors.expiresAt = "Choose a future invitation deadline.";
      else if ((job?.startDate && deadline > Date.parse(job.startDate)) || (job?.expiresAt && deadline > listingCalendarInstant(job.expiresAt, "close"))) errors.expiresAt = "The invitation deadline cannot be later than the job start or listing expiry.";
    }
  }
  return errors;
}
