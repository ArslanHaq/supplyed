"use server";

import {
  downloadOnboardingDocumentAction,
  saveOnboardingStepAction,
  submitOnboardingAction,
  uploadOnboardingDocumentAction,
} from "@/features/onboarding/actions";

export async function saveOnboardingAction(input: FormData) {
  return submitOnboardingAction(input);
}

export async function saveOnboardingStep(input: FormData) {
  return saveOnboardingStepAction(input);
}

export async function uploadOnboardingDocument(input: FormData) {
  return uploadOnboardingDocumentAction(input);
}

export async function downloadOnboardingDocument(input: FormData) {
  return downloadOnboardingDocumentAction(input);
}
