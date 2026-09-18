import type { Job } from "./types";
export function hasJobExpired(job: Pick<Job, "expiresAt">, now = Date.now()) {
  return Boolean(job.expiresAt && Date.parse(job.expiresAt) <= now);
}
export function isJobOpen(job: Job) {
  return job.status === "ACTIVE" && !hasJobExpired(job);
}
export function displayedJobStatus(job: Job) {
  return job.status === "ACTIVE" && hasJobExpired(job) ? "EXPIRED" : job.status;
}
export function formatJobPay(job: Job) {
  if (job.payAmount == null) return "Pay not specified";
  const amount = `GBP ${job.payAmount.toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;
  return job.payType === "hourly"
    ? `${amount}/hour`
    : job.payType === "daily"
      ? `${amount}/day`
      : job.payType === "fixed"
        ? `${amount} fixed`
        : amount;
}
