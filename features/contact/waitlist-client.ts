"use client";

import {
  foundingInterestAction,
  saveWaitlistDetailsAction,
  type FoundingInterestActionState,
  type WaitlistDetailsState,
} from "./actions";
import { validateWaitlist, validateWaitlistDetails } from "./validation";

// A network failure or an action from an older build rejects before the server
// can return its normal validation result. Keep that failure inside the form.
export async function submitWaitlistAction(
  previous: FoundingInterestActionState,
  form: FormData,
): Promise<FoundingInterestActionState> {
  const fieldErrors = validateWaitlist(form);
  if (Object.keys(fieldErrors).length) return { ok: false, message: "Check the highlighted fields.", fieldErrors };
  try {
    return await foundingInterestAction(previous, form);
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
    return await saveWaitlistDetailsAction(previous, form);
  } catch {
    return {
      ok: false,
      message: "We couldn't save these extra details. Your waitlist place is already saved. Please try again.",
    };
  }
}
