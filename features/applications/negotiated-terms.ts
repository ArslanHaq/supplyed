import { allowedPaymentFrequencies } from "@/features/jobs/job-schedule";
import type { OfferedJobTerms } from "@/features/jobs/offered-terms";
import type { JobPayType, PaymentFrequency } from "@/types/supplyed";

import type { BookingPaymentOverrides } from "./types";

export type NegotiatedTermsDraft = {
  days: string;
  hours: string;
  payAmount: string;
  paymentFrequency: PaymentFrequency;
  payType: JobPayType;
  periodAnchor: "ASSIGNMENT_START" | "CALENDAR";
};

export type NegotiatedTermsErrors = Partial<Record<keyof NegotiatedTermsDraft, string>>;

export function createNegotiatedTermsDraft(terms: OfferedJobTerms | null | undefined): NegotiatedTermsDraft {
  const payType = terms?.payType && ["hourly", "daily", "fixed"].includes(terms.payType) ? terms.payType : "daily";
  const supported = allowedPaymentFrequencies(payType);
  const paymentFrequency = terms?.paymentFrequency && supported.includes(terms.paymentFrequency)
    ? terms.paymentFrequency
    : defaultFrequency(payType);

  return {
    days: terms?.days == null ? "" : String(terms.days),
    hours: terms?.hours == null ? "" : String(terms.hours),
    payAmount: terms?.payAmount == null ? "" : String(terms.payAmount),
    paymentFrequency,
    payType,
    periodAnchor: terms?.periodAnchor === "CALENDAR" ? "CALENDAR" : "ASSIGNMENT_START",
  };
}

export function changeNegotiatedPayType(draft: NegotiatedTermsDraft, payType: JobPayType): NegotiatedTermsDraft {
  return {
    ...draft,
    days: payType === "daily" ? draft.days : "",
    hours: payType === "hourly" ? draft.hours : "",
    payType,
    paymentFrequency: defaultFrequency(payType),
  };
}

export function buildBookingPaymentOverrides(
  draft: NegotiatedTermsDraft,
  original: OfferedJobTerms | null | undefined,
): { errors: NegotiatedTermsErrors; overrides?: BookingPaymentOverrides } {
  const errors: NegotiatedTermsErrors = {};
  const amountText = draft.payAmount.trim();
  const amount = Number(amountText);
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(amountText) || !Number.isFinite(amount) || amount <= 0 || amount > 99_999_999.99) {
    errors.payAmount = "Enter a positive GBP amount with no more than two decimal places.";
  }
  if (!allowedPaymentFrequencies(draft.payType).includes(draft.paymentFrequency)) {
    errors.paymentFrequency = "Choose a payment frequency supported for this rate basis.";
  }

  const scheduleDeterminesUnits = Boolean(original?.schedule);
  const hours = positiveWholeNumber(draft.hours);
  const days = positiveWholeNumber(draft.days);
  if (!scheduleDeterminesUnits && draft.payType === "hourly" && hours === undefined) {
    errors.hours = "Enter the planned hours as a positive whole number.";
  }
  if (!scheduleDeterminesUnits && draft.payType === "daily" && days === undefined) {
    errors.days = "Enter the planned days as a positive whole number.";
  }
  if (Object.keys(errors).length) return { errors };

  return {
    errors,
    overrides: {
      payAmount: amount,
      payType: draft.payType,
      paymentFrequency: draft.paymentFrequency,
      ...(["weekly", "monthly"].includes(draft.paymentFrequency) ? { periodAnchor: draft.periodAnchor } : {}),
      ...(!scheduleDeterminesUnits && draft.payType === "hourly" ? { hours: hours! } : {}),
      ...(!scheduleDeterminesUnits && draft.payType === "daily" ? { days: days! } : {}),
    },
  };
}

export function paymentFrequencyLabel(value: PaymentFrequency) {
  if (value === "completion") return "On completion";
  if (value === "milestone") return "By milestones";
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

function positiveWholeNumber(value: string) {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return undefined;
  const number = Number(normalized);
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
}

function defaultFrequency(payType: JobPayType): PaymentFrequency {
  if (payType === "fixed") return "completion";
  if (payType === "hourly") return "hourly";
  return "daily";
}
