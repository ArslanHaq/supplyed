/** Only the Stripe Connect pages returned by the payout API may receive a redirect. */
export function isStripePayoutUrl(value: string | null | undefined): value is string {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "connect.stripe.com" && !url.username && !url.password && !url.port;
  } catch {
    return false;
  }
}

/** Navigate the full browser window, including when SupplyEd is embedded in a preview. */
export function openStripePayoutPage(url: string) {
  if (!isStripePayoutUrl(url)) throw new Error("Stripe returned an invalid payout link. Please try again.");
  const target = window.top ?? window;
  target.location.href = url;
}
