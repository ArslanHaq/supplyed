"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { filterProfileDocumentRequirements } from "@/features/onboarding/document-requirements";
import type {
  OnboardingDocumentRequirementSnapshot,
  OnboardingDocumentSnapshot,
  OnboardingProfileSnapshot,
} from "@/features/onboarding/types";
import type { AppRole } from "@/types/supplyed";

import { FileSummary, ReviewBadgeList } from "./ReviewCard";
import { stepContent, unselectedSteps } from "./constants";
import type {
  DocumentErrors,
  DocumentPreview,
  OnboardingDocumentDownloadActionResult,
  OnboardingDocumentUploadActionResult,
  OnboardingFinishResult,
  OnboardingPrefill,
  OnboardingPending,
  ReviewGroup,
  ReviewLine,
  SignupErrors,
  SignupForm,
  SignupRole,
  SignupStep,
  UploadedFile,
} from "./types";
import {
  buildOnboardingPayload,
  createInitialForm,
  documentFileError,
  roleLabel,
  toUploadedFileFromDocument,
  uploadedFilesFromSnapshot,
} from "./utils";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[0-9+()\s-]{10,}$/;
const domainPattern = /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,}$/i;

function snapshotFingerprint(snapshot?: OnboardingProfileSnapshot) {
  if (!snapshot) return "";

  return JSON.stringify({
    documentRequirements: snapshot.documentRequirements,
    documents: snapshot.documents,
    institution: snapshot.institution,
    instructor: snapshot.instructor,
    recruiter: snapshot.recruiter,
    requirementDocuments: snapshot.requirementDocuments,
    role: snapshot.role,
    user: snapshot.user,
  });
}

function snapshotString(current: string, next: string) {
  return next.trim() ? next : current;
}

function snapshotStringArray(current: string[], next: string[]) {
  return next.length > 0 ? next : current;
}

function hasCreatedProfile(snapshot: OnboardingProfileSnapshot | undefined, role: SignupRole) {
  if (!snapshot) return false;
  if (role === "teacher") return Boolean(snapshot.instructor?.id);
  if (role === "institution") return Boolean(snapshot.institution?.id);
  return Boolean(snapshot.recruiter?.id);
}

function missingRequiredDocumentRequirements(
  requirements: OnboardingDocumentRequirementSnapshot[],
  documents: Record<string, OnboardingDocumentSnapshot>,
) {
  return requirements.filter((requirement) => requirement.isRequired && !documents[requirement.id]?.uploadedAt);
}

function missingSnapshotDocumentRequirements(snapshot: OnboardingProfileSnapshot | undefined, role: SignupRole) {
  if (!snapshot) return [];

  return missingRequiredDocumentRequirements(
    filterProfileDocumentRequirements(snapshot.documentRequirements ?? [], role),
    snapshot.requirementDocuments ?? {},
  );
}

function requirementErrorEntries(requirements: OnboardingDocumentRequirementSnapshot[]) {
  return Object.fromEntries(requirements.map((requirement) => [requirement.id, `${requirement.documentType.name} is required.`]));
}

function mergeSnapshotForm(current: SignupForm, accountEmail: string | undefined, snapshot?: OnboardingProfileSnapshot) {
  if (!snapshot) return current;

  const next = createInitialForm(accountEmail, snapshot);

  return {
    ...current,
    bio: snapshotString(current.bio, next.bio),
    complianceContact: snapshotString(current.complianceContact, next.complianceContact),
    complianceEmail: snapshotString(current.complianceEmail, next.complianceEmail),
    contactRole: snapshotString(current.contactRole, next.contactRole),
    coverTypes: snapshotStringArray(current.coverTypes, next.coverTypes),
    currency: next.currency || current.currency || "GBP",
    dailyRate: snapshotString(current.dailyRate, next.dailyRate),
    documents: { ...current.documents, ...next.documents },
    email: snapshotString(current.email, next.email),
    fullName: snapshotString(current.fullName, next.fullName),
    hourlyRate: snapshotString(current.hourlyRate, next.hourlyRate),
    institutionAddress: snapshotString(current.institutionAddress, next.institutionAddress),
    institutionCity: snapshotString(current.institutionCity, next.institutionCity),
    institutionCountryCode: next.institutionCountryCode || current.institutionCountryCode || "GB",
    institutionDomain: snapshotString(current.institutionDomain, next.institutionDomain),
    institutionProfileId: snapshotString(current.institutionProfileId, next.institutionProfileId),
    institutionRegistrationId: snapshotString(current.institutionRegistrationId, next.institutionRegistrationId),
    keyStages: snapshotStringArray(current.keyStages, next.keyStages),
    localAuthority: snapshotString(current.localAuthority, next.localAuthority),
    maxTravelDistance: snapshotString(current.maxTravelDistance, next.maxTravelDistance),
    phone: snapshotString(current.phone, next.phone),
    postcode: snapshotString(current.postcode, next.postcode),
    recruiterProfileId: snapshotString(current.recruiterProfileId, next.recruiterProfileId),
    schoolName: snapshotString(current.schoolName, next.schoolName),
    safeguardingConfirmed: current.safeguardingConfirmed || next.safeguardingConfirmed,
    skills: snapshotStringArray(current.skills, next.skills),
    staffingNeeds: snapshotString(current.staffingNeeds, next.staffingNeeds),
    subjects: snapshotStringArray(current.subjects, next.subjects),
    teacherProfileId: snapshotString(current.teacherProfileId, next.teacherProfileId),
    typicalPupilCount: snapshotString(current.typicalPupilCount, next.typicalPupilCount),
    yearsExperience: snapshotString(current.yearsExperience, next.yearsExperience),
  };
}

function fillEmpty(current: string, next?: string) {
  return current.trim() ? current : next?.trim() ?? current;
}

function fillEmptyArray(current: string[], next?: string[]) {
  return current.length > 0 ? current : next ?? current;
}

function mergePrefillForm(current: SignupForm, prefill?: OnboardingPrefill) {
  if (!prefill) return current;

  return {
    ...current,
    bio: fillEmpty(current.bio, prefill.bio),
    complianceContact: fillEmpty(current.complianceContact, prefill.complianceContact),
    complianceEmail: fillEmpty(current.complianceEmail, prefill.complianceEmail),
    contactRole: fillEmpty(current.contactRole, prefill.contactRole),
    coverTypes: fillEmptyArray(current.coverTypes, prefill.coverTypes),
    currency: fillEmpty(current.currency, prefill.currency),
    dailyRate: fillEmpty(current.dailyRate, prefill.dailyRate),
    email: fillEmpty(current.email, prefill.email),
    fullName: fillEmpty(current.fullName, prefill.fullName),
    hourlyRate: fillEmpty(current.hourlyRate, prefill.hourlyRate),
    institutionAddress: fillEmpty(current.institutionAddress, prefill.institutionAddress),
    institutionCity: fillEmpty(current.institutionCity, prefill.institutionCity),
    institutionCountryCode: fillEmpty(current.institutionCountryCode, prefill.institutionCountryCode),
    institutionDomain: fillEmpty(current.institutionDomain, prefill.institutionDomain),
    keyStages: fillEmptyArray(current.keyStages, prefill.keyStages),
    localAuthority: fillEmpty(current.localAuthority, prefill.localAuthority),
    maxTravelDistance: fillEmpty(current.maxTravelDistance, prefill.maxTravelDistance),
    phone: fillEmpty(current.phone, prefill.phone),
    postcode: fillEmpty(current.postcode, prefill.postcode),
    schoolName: fillEmpty(current.schoolName, prefill.schoolName),
    skills: fillEmptyArray(current.skills, prefill.skills),
    staffingNeeds: fillEmpty(current.staffingNeeds, prefill.staffingNeeds),
    subjects: fillEmptyArray(current.subjects, prefill.subjects),
    typicalPupilCount: fillEmpty(current.typicalPupilCount, prefill.typicalPupilCount),
    yearsExperience: fillEmpty(current.yearsExperience, prefill.yearsExperience),
  };
}

export function useOnboardingForm({
  accountEmail,
  initialSnapshot,
  onFinish,
  onDocumentView,
  onDocumentUpload,
  onStepSave,
  prefill,
  role,
  roleSelected,
  setStep,
  step,
}: {
  accountEmail?: string;
  initialSnapshot?: OnboardingProfileSnapshot;
  onFinish: (payload: FormData) => Promise<OnboardingFinishResult>;
  onDocumentView: (payload: FormData) => Promise<OnboardingDocumentDownloadActionResult>;
  onDocumentUpload: (payload: FormData) => Promise<OnboardingDocumentUploadActionResult>;
  onStepSave: (payload: FormData) => Promise<OnboardingFinishResult>;
  prefill?: OnboardingPrefill;
  role: AppRole;
  roleSelected: boolean;
  setStep: (step: number) => void;
  step: number;
}) {
  const activeRole: SignupRole = role === "teacher" ? "teacher" : role === "individual" ? "individual" : "institution";
  const steps = useMemo(() => (roleSelected ? stepContent(activeRole) : unselectedSteps), [activeRole, roleSelected]);
  const currentStep = Math.min(steps.length, Math.max(1, step)) as SignupStep;
  const [form, setForm] = useState<SignupForm>(() => mergePrefillForm(createInitialForm(accountEmail, initialSnapshot), prefill));
  const [errors, setErrors] = useState<SignupErrors>({});
  const [documentErrors, setDocumentErrors] = useState<DocumentErrors>({});
  const [pending, setPending] = useState<OnboardingPending>(null);
  const [uploadPending, setUploadPending] = useState<string | null>(null);
  const [viewPending, setViewPending] = useState<string | null>(null);
  const [documentPreview, setDocumentPreview] = useState<DocumentPreview | null>(null);
  const [documentRequirementsSnapshot, setDocumentRequirementsSnapshot] = useState<OnboardingDocumentRequirementSnapshot[]>(
    () => initialSnapshot?.documentRequirements ?? [],
  );
  const [lockedDocumentStage, setLockedDocumentStage] = useState(
    () => hasCreatedProfile(initialSnapshot, activeRole) && missingSnapshotDocumentRequirements(initialSnapshot, activeRole).length > 0,
  );
  const [requirementDocuments, setRequirementDocuments] = useState<Record<string, OnboardingDocumentSnapshot>>(() => initialSnapshot?.requirementDocuments ?? {});
  const [requirementDocumentErrors, setRequirementDocumentErrors] = useState<Record<string, string | undefined>>({});
  const [requirementUploadPending, setRequirementUploadPending] = useState<string | null>(null);
  const [requirementViewPending, setRequirementViewPending] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string>();
  const progress = Math.round((currentStep / steps.length) * 100);
  const isLastStep = currentStep === steps.length;
  const mountedRef = useRef(true);
  const previousStepRef = useRef(currentStep);
  const initialSnapshotFingerprint = useMemo(() => snapshotFingerprint(initialSnapshot), [initialSnapshot]);
  const documentRequirements = filterProfileDocumentRequirements(documentRequirementsSnapshot, activeRole);
  const previousSnapshotFingerprintRef = useRef(initialSnapshotFingerprint);
  const prefillFingerprint = useMemo(() => JSON.stringify(prefill ?? {}), [prefill]);
  const previousPrefillFingerprintRef = useRef(prefillFingerprint);

  const documentRequirementsLoading = false;
  const documentRequirementsError = undefined;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (previousStepRef.current === currentStep) return;

    previousStepRef.current = currentStep;
    setPending((current) => (current === "step" ? null : current));
  }, [currentStep]);

  useEffect(() => {
    if (previousSnapshotFingerprintRef.current === initialSnapshotFingerprint) return;

    previousSnapshotFingerprintRef.current = initialSnapshotFingerprint;
    setForm((current) => mergeSnapshotForm(current, accountEmail, initialSnapshot));
    if (initialSnapshot?.documentRequirements.length || !lockedDocumentStage) {
      setDocumentRequirementsSnapshot(initialSnapshot?.documentRequirements ?? []);
    }
    setRequirementDocuments(initialSnapshot?.requirementDocuments ?? {});
    if (hasCreatedProfile(initialSnapshot, activeRole) && missingSnapshotDocumentRequirements(initialSnapshot, activeRole).length > 0) {
      setLockedDocumentStage(true);
    }
  }, [accountEmail, activeRole, initialSnapshot, initialSnapshotFingerprint, lockedDocumentStage]);

  function buildPayload() {
    return buildOnboardingPayload(form, activeRole, currentStep, accountEmail);
  }

  const reviewGroups = useMemo<ReviewGroup[]>(() => {
    const accountLines: ReviewLine[] = [
      { label: "Account type", value: roleLabel(activeRole) },
      { label: "Name", value: form.fullName || "Not provided" },
      { label: "Email", value: form.email || accountEmail || "Not provided" },
      { label: "Phone", value: form.phone || "Not provided" },
      { label: "Postalcode / location", value: form.postcode || "Not provided" },
    ];

    if (activeRole === "teacher") {
      const documentLines: ReviewLine[] =
        documentRequirements.length > 0
          ? documentRequirements.map((requirement) => ({
              label: requirement.isRequired ? requirement.documentType.name : `${requirement.documentType.name} (optional)`,
              value: <FileSummary file={form.documents[requirement.id] ?? null} />,
              wide: true,
            }))
          : [{ label: "Documents", value: <span className="text-muted">No document requirements loaded</span>, wide: true }];

      return [
        {
          title: "Teacher Profile",
          description: "Contact, teaching, rate, and travel details",
          icon: "user",
          editStep: 1,
          lines: [
            ...accountLines,
            { label: "Subjects", value: <ReviewBadgeList items={form.subjects} />, wide: true },
            { label: "Key stages", value: <ReviewBadgeList items={form.keyStages} />, wide: true },
            { label: "Skills", value: <ReviewBadgeList items={form.skills} />, wide: true },
            { label: "Experience", value: form.yearsExperience ? `${form.yearsExperience} years` : "Not provided" },
            { label: "Daily rate", value: form.dailyRate ? `${form.currency || "GBP"} ${form.dailyRate}` : "Optional" },
            { label: "Hourly rate", value: form.hourlyRate ? `${form.currency || "GBP"} ${form.hourlyRate}` : "Optional" },
            { label: "Travel distance", value: form.maxTravelDistance ? `${form.maxTravelDistance} miles` : "Optional" },
            { label: "TRN", value: form.teachingReferenceNumber || "Optional" },
            { label: "Bio", value: form.bio || "Not provided", wide: true },
          ],
        }
      ];
    }

    if (activeRole === "individual") {
      return [
        {
          title: "Individual Profile",
          description: "Contact details for your hiring account",
          icon: "user",
          editStep: 1,
          lines: accountLines,
        },
      ];
    }

    return [
      {
        title: "Account",
        description: "Login and contact details",
        icon: "user",
        editStep: 1,
        lines: accountLines,
      },
      {
        title: "School Workspace",
        description: "Organisation and staffing needs",
        icon: "building",
        editStep: 2,
        lines: [
          { label: "School / MAT", value: form.schoolName || "Not provided" },
          { label: "Your role", value: form.contactRole || "Not provided" },
          { label: "Domain", value: form.institutionDomain || "Not provided" },
          { label: "Address", value: form.institutionAddress || "Not provided", wide: true },
          { label: "City", value: form.institutionCity || "Not provided" },
          { label: "County / region", value: form.localAuthority || "Not provided" },
          { label: "Country", value: form.institutionCountryCode || "GB" },
          { label: "Registration ID", value: form.institutionRegistrationId || "Optional" },
          { label: "Pupil count", value: form.typicalPupilCount || "Optional" },
          { label: "Needs", value: <ReviewBadgeList items={form.coverTypes} />, wide: true },
        ],
      },
      {
        title: "Compliance",
        description: "Safeguarding approval",
        icon: "shield",
        editStep: 3,
        lines: [
          { label: "Compliance lead", value: form.complianceContact || "Not provided" },
          { label: "Compliance email", value: form.complianceEmail || "Not provided" },
          { label: "Safeguarding", value: form.safeguardingConfirmed ? "Authorised staff confirmed" : "Not confirmed" },
        ],
      },
    ];
  }, [accountEmail, activeRole, documentRequirements, form]);

  function updateField<FieldName extends keyof SignupForm>(field: FieldName, value: SignupForm[FieldName]) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError(undefined);
  }

  function setDocumentError(requirementId: string, message: string | undefined) {
    setDocumentErrors((current) => ({ ...current, [requirementId]: message }));
  }

  function clearDocumentError(requirementId: string) {
    setDocumentError(requirementId, undefined);
    setErrors((current) => ({ ...current, documents: undefined }));
    setSubmitError(undefined);
  }

  function retryDocumentRequirements() {
    setDocumentRequirementsSnapshot(initialSnapshot?.documentRequirements ?? []);
  }

  async function uploadDocument(requirement: OnboardingDocumentRequirementSnapshot, file: UploadedFile) {
    await uploadRequirementDocument(requirement.id, file);
  }

  async function viewDocument(requirementId: string, file: UploadedFile | null) {
    await viewRequirementDocument(requirementId, file);
  }

  async function uploadRequirementDocument(requirementId: string, file: UploadedFile) {
    if (pending === "submit" || requirementUploadPending) return;

    const requirement = documentRequirements.find((item) => item.id === requirementId);
    const label = requirement?.documentType.name || "Document";
    const selectedFile = file.file;
    const validationError = selectedFile
      ? requirement
        ? documentFileError(
            { ...file, id: "validation-placeholder" },
            {
              allowedMimes: requirement.documentType.allowedMimes,
              code: requirement.documentType.code,
              context: requirement.context,
              description: null,
              id: requirement.id,
              isRequired: requirement.isRequired,
              maxSizeBytes: requirement.documentType.maxSizeBytes,
              name: label,
              requiresReview: true,
            },
          )
        : undefined
      : `${label} is required.`;

    if (validationError) {
      setRequirementDocumentErrors((current) => ({ ...current, [requirementId]: validationError }));
      return;
    }

    const data = buildPayload();
    data.set("requirementId", requirementId);
    data.set("file", selectedFile!, file.name);

    setRequirementDocumentErrors((current) => ({ ...current, [requirementId]: undefined }));
    setSubmitError(undefined);
    setRequirementUploadPending(requirementId);

    try {
      const result = await onDocumentUpload(data);

      if (!result.ok || !result.data?.document) {
        setRequirementDocumentErrors((current) => ({
          ...current,
          [requirementId]: result.message || `${label} could not be uploaded. Choose the file again.`,
        }));
        return;
      }

      setRequirementDocuments((current) => ({
        ...current,
        ...result.data!.requirementDocuments,
        [requirementId]: result.data!.document,
      }));
      setRequirementDocumentErrors((current) => ({ ...current, [requirementId]: undefined }));
    } catch (error) {
      setRequirementDocumentErrors((current) => ({
        ...current,
        [requirementId]: error instanceof Error && error.message ? error.message : `${label} could not be uploaded. Choose the file again.`,
      }));
    } finally {
      if (mountedRef.current) setRequirementUploadPending(null);
    }
  }

  async function viewRequirementDocument(requirementId: string, file: UploadedFile | null) {
    if (!file?.id || requirementViewPending) return;

    const data = new FormData();
    data.set("documentId", file.id);
    data.set("fileName", file.name);
    setRequirementViewPending(requirementId);
    setSubmitError(undefined);

    try {
      const result = await onDocumentView(data);

      if (!result.ok || !result.data?.url) {
        setRequirementDocumentErrors((current) => ({
          ...current,
          [requirementId]: result.message || "This document could not be opened.",
        }));
        return;
      }

      setDocumentPreview({
        expiresAt: result.data.expiresAt,
        file,
        url: result.data.url,
      });
    } catch (error) {
      setRequirementDocumentErrors((current) => ({
        ...current,
        [requirementId]: error instanceof Error && error.message ? error.message : "This document could not be opened.",
      }));
    } finally {
      if (mountedRef.current) setRequirementViewPending(null);
    }
  }

  function closeDocumentPreview() {
    setDocumentPreview(null);
  }

  function clearFieldError(field: keyof SignupErrors) {
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError(undefined);
  }

  function applySnapshot(snapshot?: OnboardingProfileSnapshot, options?: { preserveDocumentRequirements?: boolean }) {
    if (!snapshot) return;
    setForm((current) => mergeSnapshotForm(current, accountEmail, snapshot));
    if (snapshot.documentRequirements.length || !options?.preserveDocumentRequirements) {
      setDocumentRequirementsSnapshot(snapshot.documentRequirements);
    }
    setRequirementDocuments(snapshot.requirementDocuments ?? {});
  }

  function validateStep(targetStep: SignupStep) {
    const nextErrors: SignupErrors = {};

    if (targetStep === 1) {
      if (!roleSelected) nextErrors.accountRole = "Choose how you want to use SupplyED.";
      if (!form.fullName.trim()) nextErrors.fullName = "Enter your full name.";
      if (!form.phone.trim()) nextErrors.phone = "Enter a contact number.";
      else if (!phonePattern.test(form.phone.trim())) nextErrors.phone = "Use a valid phone number.";
      if (!form.postcode.trim()) nextErrors.postcode = "Enter your postalcode or location.";

      if (activeRole === "teacher") {
        if (form.subjects.length === 0) nextErrors.subjects = "Choose at least one subject.";
        if (form.keyStages.length === 0) nextErrors.keyStages = "Choose at least one key stage.";
        if (!form.yearsExperience.trim()) nextErrors.yearsExperience = "Enter your years of experience.";
        else if (Number(form.yearsExperience) < 0) nextErrors.yearsExperience = "Experience cannot be negative.";
        if (form.hourlyRate && Number(form.hourlyRate) < 0) nextErrors.hourlyRate = "Hourly rate cannot be negative.";
        if (form.dailyRate && Number(form.dailyRate) < 0) nextErrors.dailyRate = "Daily rate cannot be negative.";
        if (form.maxTravelDistance && Number(form.maxTravelDistance) < 0) nextErrors.maxTravelDistance = "Travel distance cannot be negative.";
        if (form.bio.trim().length < 40) nextErrors.bio = "Write at least 40 characters so schools understand your teaching style.";
      }
    }

    if (targetStep === 2 && activeRole === "institution") {
      if (!form.schoolName.trim()) nextErrors.schoolName = "Enter the school or MAT name.";
      if (!form.contactRole.trim()) nextErrors.contactRole = "Enter your role.";
      if (!form.institutionDomain.trim()) nextErrors.institutionDomain = "Enter the school or trust domain.";
      else if (!domainPattern.test(form.institutionDomain.trim())) nextErrors.institutionDomain = "Use a valid domain, for example greenfield.ac.uk.";
      if (!form.institutionAddress.trim()) nextErrors.institutionAddress = "Enter the institution address.";
      if (!form.institutionCity.trim()) nextErrors.institutionCity = "Enter the city.";
      if (!form.localAuthority.trim()) nextErrors.localAuthority = "Enter the county or region.";
      if (form.coverTypes.length === 0) nextErrors.coverTypes = "Choose at least one staffing need.";
    }

    if (targetStep === 3 && activeRole === "institution") {
      if (!form.complianceContact.trim()) nextErrors.complianceContact = "Enter the safeguarding or compliance lead.";
      if (!form.complianceEmail.trim()) nextErrors.complianceEmail = "Enter the compliance email.";
      else if (!emailPattern.test(form.complianceEmail.trim())) nextErrors.complianceEmail = "Use a valid email address.";
      if (!form.safeguardingConfirmed) nextErrors.safeguardingConfirmed = "Confirm safeguarding responsibility.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function continueStep() {
    if (lockedDocumentStage || pending || uploadPending || requirementUploadPending) return;
    if (!validateStep(currentStep)) return;

    setPending("step");
    setSubmitError(undefined);

    try {
      const result = await onStepSave(buildPayload());
      if (!result.ok) {
        setSubmitError(result.message || "This step could not be saved. Try again.");
        return;
      }

      applySnapshot(result.data?.snapshot);
      setStep(currentStep + 1);
      setErrors({});
    } catch (error) {
      setSubmitError(error instanceof Error && error.message ? error.message : "This step could not be saved. Try again.");
    } finally {
      if (mountedRef.current) setPending(null);
    }
  }

  async function submitSignup() {
    if (pending || uploadPending || requirementUploadPending) return;
    for (let targetStep = 1; targetStep < steps.length; targetStep += 1) {
      if (!validateStep(targetStep as SignupStep)) {
        setStep(targetStep);
        return;
      }
    }

    setPending("submit");
    setSubmitError(undefined);

    try {
      const currentMissingRequirements = missingRequiredDocumentRequirements(documentRequirements, requirementDocuments);
      const adminConfigResult = await onStepSave(buildPayload());
      if (!adminConfigResult.ok) {
        setSubmitError(adminConfigResult.message || "Document requirements could not be checked. Try again.");
        return;
      }

      const latestSnapshot = adminConfigResult.data?.snapshot;
      const latestRequirements = filterProfileDocumentRequirements(latestSnapshot?.documentRequirements ?? [], activeRole);
      const latestRequirementDocuments = latestSnapshot?.requirementDocuments ?? {};
      const latestMissingRequirements = missingRequiredDocumentRequirements(latestRequirements, latestRequirementDocuments);
      const missingRequirementsBeforeProfile = latestMissingRequirements.length > 0 ? latestMissingRequirements : currentMissingRequirements;

      applySnapshot(latestSnapshot);

      const payload = buildPayload();
      if (missingRequirementsBeforeProfile.length > 0) {
        payload.set("intent", "profile");
      }

      const result = await onFinish(payload);
      if (!result.ok) {
        setSubmitError(result.message || "Onboarding could not be submitted. Try again.");
        return;
      }

      const snapshot = result.data?.snapshot;
      applySnapshot(snapshot, { preserveDocumentRequirements: missingRequirementsBeforeProfile.length > 0 });

      if (
        result.data?.applicationStatus === "none" &&
        (missingRequirementsBeforeProfile.length > 0 || missingSnapshotDocumentRequirements(snapshot, activeRole).length > 0)
      ) {
        setLockedDocumentStage(true);
        setRequirementDocumentErrors({});
        setSubmitError(undefined);
      }
    } catch (error) {
      setSubmitError(error instanceof Error && error.message ? error.message : "Onboarding could not be submitted. Try again.");
    } finally {
      if (mountedRef.current) setPending(null);
    }
  }

  async function submitDocumentsForReview() {
    if (pending || uploadPending || requirementUploadPending) return;

    const missingRequirements = missingRequiredDocumentRequirements(documentRequirements, requirementDocuments);
    if (missingRequirements.length > 0) {
      setRequirementDocumentErrors((current) => ({
        ...current,
        ...requirementErrorEntries(missingRequirements),
      }));
      setSubmitError("Upload all required documents before sending the profile for review.");
      return;
    }

    setPending("submit");
    setSubmitError(undefined);

    try {
      const payload = buildPayload();
      payload.set("intent", "review");

      const result = await onFinish(payload);
      if (!result.ok) {
        setSubmitError(result.message || "Profile could not be sent for review. Try again.");
        return;
      }

      const snapshot = result.data?.snapshot;
      applySnapshot(snapshot);
      const remainingRequirements = missingSnapshotDocumentRequirements(snapshot, activeRole);

      if (result.data?.applicationStatus === "none" && remainingRequirements.length > 0) {
        setLockedDocumentStage(true);
        setRequirementDocumentErrors((current) => ({
          ...current,
          ...requirementErrorEntries(remainingRequirements),
        }));
        setSubmitError(result.message || "Upload all required documents before sending the profile for review.");
      }
    } catch (error) {
      setSubmitError(error instanceof Error && error.message ? error.message : "Profile could not be sent for review. Try again.");
    } finally {
      if (mountedRef.current) setPending(null);
    }
  }

  return {
    activeRole,
    clearDocumentError,
    clearFieldError,
    continueStep,
    closeDocumentPreview,
    currentStep,
    documentErrors,
    documentPreview,
    documentRequirements,
    documentRequirementsError,
    documentRequirementsLoading,
    errors,
    form,
    isLastStep,
    lockedDocumentStage,
    pending,
    progress,
    requirementDocumentErrors,
    requirementDocuments,
    requirementUploadPending,
    requirementViewPending,
    reviewGroups,
    retryDocumentRequirements,
    setStep,
    steps,
    submitDocumentsForReview,
    submitError,
    submitSignup,
    uploadDocument,
    uploadPending,
    uploadRequirementDocument,
    updateField,
    viewDocument,
    viewPending,
    viewRequirementDocument,
  };
}

export type OnboardingFormController = ReturnType<typeof useOnboardingForm>;
