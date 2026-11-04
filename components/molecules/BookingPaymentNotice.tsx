import type { JobPayType } from "@/types/supplyed";

export function BookingPaymentNotice({ job }: { job: { payAmount?: number | null; payType?: JobPayType | string | null } | null | undefined }) {
  const amount = job?.payAmount;
  const rate = amount != null ? new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount) : null;
  const rateLabel = job?.payType === "hourly" ? "per hour" : job?.payType === "fixed" ? "fixed price" : "per day";

  return (
    <div className="mt-4 rounded-xl border border-border bg-chalk p-4">
      <h3 className="text-sm font-semibold text-ink">Automatic card payment through Stripe</h3>
      {rate ? <p className="mt-1 text-sm text-muted">Agreed rate: <span className="font-semibold text-ink">{rate} {rateLabel}</span></p> : null}
      <p className="mt-2 text-sm leading-6 text-muted">
        {job?.payType === "fixed"
          ? "Fixed-price work payable on completion is charged automatically to the school's authorised saved card. If all recorded attendance is absent, no payment is charged. Mixed attendance needs review before a fixed contract amount can be charged; completion without attendance decisions uses the agreed total."
          : "SupplyED automatically charges the school's authorised saved card for present attendance, excluding absent shifts from each daily, weekly or monthly period. If a booking is completed with no attendance decisions, the accepted scheduled hours or days are used."}
        {" "}The school authorises its card once in Billing and does not release each payment. The teacher must finish payout setup first. Each payment record shows the final total, including the platform fee. Stripe may request a card security check or report a failed payment in Billing.
      </p>
    </div>
  );
}
