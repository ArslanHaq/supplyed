import { redirect } from "next/navigation";

/** Stripe sends the teacher here after its hosted payout setup; the payments page shows the result. */
export default function PayoutsReturnPage() {
  redirect("/billing?payouts=returned");
}
