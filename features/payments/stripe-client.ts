"use client";

import type { AppearanceOptions } from "@stripe/connect-js";
import { loadStripe, type Appearance, type CssFontSource, type Stripe } from "@stripe/stripe-js";

/**
 * Stripe's forms run in Stripe-hosted frames inside SupplyEd's pages, so card
 * and bank details go from the browser straight to Stripe. These settings
 * make the frames look like the rest of the app.
 */
const defaultTheme = {
  border: "#cbd5dd",
  brand: "#006e9a",
  danger: "#cf1941",
  font: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  ink: "#15232d",
  muted: "#5f707b",
  radius: "9px",
  surface: "#ffffff",
};

/** The app's font, for Stripe's frames, which cannot use the page's own. */
export const stripeFonts: CssFontSource[] = [{ cssSrc: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" }];

// Iframes cannot inherit CSS variables. Resolve the active SupplyEd theme when
// creating a frame, with the same defaults for server rendering.
function currentTheme() {
  if (typeof window === "undefined") return defaultTheme;
  const styles = window.getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
  return {
    ...defaultTheme,
    border: token("--border-2", defaultTheme.border),
    brand: token("--se-dark", defaultTheme.brand),
    danger: token("--red", defaultTheme.danger),
    ink: token("--ink", defaultTheme.ink),
    muted: token("--muted", defaultTheme.muted),
    radius: token("--control-radius", defaultTheme.radius),
    surface: token("--surface", defaultTheme.surface),
  };
}

/** Keep existing Stripe frames in sync without recreating sessions or secrets. */
export function observeStripeTheme(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  let previous = JSON.stringify(currentTheme());
  const observer = new MutationObserver(() => {
    const next = JSON.stringify(currentTheme());
    if (next === previous) return;
    previous = next;
    onChange();
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class"] });
  return () => observer.disconnect();
}

export function getPaymentAppearance(): Appearance {
  const theme = currentTheme();
  return {
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
    rules: { ".Input": { borderColor: theme.border } },
  };
}

export function getConnectAppearance(): AppearanceOptions {
  const theme = currentTheme();
  return {
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
}

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
