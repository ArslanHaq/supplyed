"use client";

import type { AppearanceOptions } from "@stripe/connect-js";
import { loadStripe, type Appearance, type CssFontSource, type Stripe } from "@stripe/stripe-js";

/**
 * Stripe's forms run in Stripe-hosted frames inside SupplyEd's pages, so card
 * and bank details go from the browser straight to Stripe. These settings
 * make the frames look like the rest of the app.
 */
const theme = {
  border: "#e5e7eb",
  brand: "#008cc4",
  danger: "#e11d48",
  font: '"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif',
  ink: "#0a0a0a",
  muted: "#6b7280",
  radius: "8px",
  surface: "#ffffff",
};

/** The app's font, for Stripe's frames, which cannot use the page's own. */
export const stripeFonts: CssFontSource[] = [{ cssSrc: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" }];

export const paymentAppearance: Appearance = {
  theme: "stripe",
  variables: {
    borderRadius: theme.radius,
    colorBackground: theme.surface,
    colorDanger: theme.danger,
    colorPrimary: theme.brand,
    colorText: theme.ink,
    colorTextSecondary: theme.muted,
    fontFamily: theme.font,
  },
};

export const connectAppearance: AppearanceOptions = {
  variables: {
    borderRadius: theme.radius,
    buttonPrimaryColorBackground: theme.brand,
    colorBackground: theme.surface,
    colorBorder: theme.border,
    colorDanger: theme.danger,
    colorPrimary: theme.brand,
    colorSecondaryText: theme.muted,
    colorText: theme.ink,
    fontFamily: theme.font,
  },
};

const stripeByKey = new Map<string, Promise<Stripe | null>>();

/** One Stripe.js instance per publishable key for the whole page; Stripe warns when it is loaded twice. */
export function getStripe(publishableKey: string) {
  let stripe = stripeByKey.get(publishableKey);
  if (!stripe) {
    stripe = loadStripe(publishableKey);
    stripeByKey.set(publishableKey, stripe);
  }
  return stripe;
}
