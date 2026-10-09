import type { Job } from "@/features/jobs/types";

export function BookingPaymentNotice({ job }: { job: Job | null }) {
  const rate = job?.rate ? new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(job.rate) : null;
  const rateLabel = job?.payType === "hourly" ? "per hour" : job?.payType === "fixed" ? "fixed price" : "per day";

  return (
    <div className="mt-4 rounded-xl border border-border bg-chalk p-4">
      <h3 className="text-sm font-semibold text-ink">Payment through Stripe</h3>
      {rate ? <p className="mt-1 text-sm text-muted">Agreed rate: <span className="font-semibold text-ink">{rate} {rateLabel}</span></p> : null}
      <p className="mt-2 text-sm leading-6 text-muted">
        Once the booking is completed, create its invoice from Bookings and pay securely on Stripe.
        {job?.payType === "hourly" ? " Confirm the hours worked when invoicing." : job?.payType === "daily" ? " Confirm the days worked when invoicing." : ""}
        {" "}The teacher must finish payout setup first. Your invoice will show the final total, including the platform fee.
      </p>
    </div>
  );
}
