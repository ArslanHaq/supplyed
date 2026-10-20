"use client";

import {
  foundingInterestAction,
  saveWaitlistDetailsAction,
  type FoundingInterestActionState,
  type WaitlistDetailsState,
} from "./actions";
import { validateWaitlist, validateWaitlistDetails } from "./validation";
import { fetchJson } from "@/lib/query/fetch-json";
import type { Dropdown } from "@/features/dropdowns/types";
import { refreshDropdownsAfterFailure } from "@/features/dropdowns/refresh";

// A network failure or an action from an older build rejects before the server
// can return its normal validation result. Keep that failure inside the form.
export async function submitWaitlistAction(
  previous: FoundingInterestActionState,
  form: FormData,
): Promise<FoundingInterestActionState> {
  const fieldErrors = validateWaitlist(form);
  if (Object.keys(fieldErrors).length) return { ok: false, message: "Check the highlighted fields.", fieldErrors };
  try {
    const names = form.get("type") === "SCHOOL" ? ["waitlistSchoolRole", "waitlistSchoolArea", "waitlistSchoolType", "supplyDaysPerTerm", "coverBookingMethod"] : ["waitlistTeacherRole", "waitlistTeacherArea", "currentSupply", "daysPerWeek"];
    const collections = await Promise.all(names.map(name => fetchJson<Dropdown>(`/api/dropdowns/${name}`)));
    const choices = Object.fromEntries(collections.map(collection => [collection.name, collection.options.map(option => option.value)]));
    const errors = validateWaitlist(form, choices);
    if (Object.keys(errors).length) { window.dispatchEvent(new Event("supplyed:refresh-dropdowns")); return { ok: false, message: "Some choices have changed. Review the highlighted fields.", fieldErrors: errors }; }
    const result = await foundingInterestAction(previous, form);
    refreshDropdownsAfterFailure(result);
    return result;
  } catch {
    return {
      ok: false,
      message: "We couldn't confirm your submission. Please refresh this page and try again. If it was already saved, you won't be added twice.",
    };
  }
}

export async function submitWaitlistDetailsAction(
  previous: WaitlistDetailsState,
  form: FormData,
): Promise<WaitlistDetailsState> {
  const fieldErrors = validateWaitlistDetails(form);
  if (Object.keys(fieldErrors).length) return { ok: false, message: "Check the highlighted fields.", fieldErrors };
  try {
    const collection = await fetchJson<Dropdown>("/api/dropdowns/waitlistPhase");
    if (form.getAll("phases").some(value => !collection.options.some(option => option.value === value))) { window.dispatchEvent(new Event("supplyed:refresh-dropdowns")); return { ok: false, message: "Review your teaching phases.", fieldErrors: { phases: "A selected phase is no longer available." } }; }
    const result = await saveWaitlistDetailsAction(previous, form);
    refreshDropdownsAfterFailure(result);
    return result;
  } catch {
    return {
      ok: false,
      message: "We couldn't save these extra details. Your waitlist place is already saved. Please try again.",
    };
  }
}
