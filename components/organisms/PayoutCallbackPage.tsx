import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

import { buttonClassName } from "../atoms";
import { PageHead } from "../molecules";
import { PayoutSettings } from "./PayoutSettings";

export async function PayoutCallbackPage({ kind }: { kind: "return" | "refresh" }) {
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=${encodeURIComponent(`/payouts/${kind}`)}`);
  if (session.user.authErrorMessage || !session.user.isEmailVerified) redirect("/post-auth");
  if (session.user.role !== "teacher") redirect("/dashboard");

  return (
    <main className="payout-callback mx-auto w-full max-w-[920px] px-5 py-10 sm:px-8">
      <Link className="account-back-link" href="/settings">← Back to account settings</Link>
      <PageHead
        title={kind === "return" ? "Your payout setup" : "Resume payout setup"}
        subtitle={kind === "return"
          ? "Checking your current account status with Stripe."
          : "Your previous Stripe link expired. Continue your setup below."}
      />
      <PayoutSettings openSetup={kind === "refresh"} returnedFromStripe={kind === "return"} />
      <nav aria-label="Account pages" className="mt-5 flex flex-wrap gap-3">
        <Link className={buttonClassName({ variant: "secondary" })} href="/settings">Account settings</Link>
        <Link className={buttonClassName({ variant: "ghost" })} href="/billing">View earnings</Link>
      </nav>
    </main>
  );
}
