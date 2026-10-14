/** Hosted invoice and PDF links are served by Stripe. */
export function stripeInvoiceUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && (url.hostname === "stripe.com" || url.hostname.endsWith(".stripe.com"))
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}
