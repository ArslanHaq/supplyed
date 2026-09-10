"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { documentFileValidationError } from "@/features/onboarding/document-utils";
import type { OnboardingDocumentRequirement, OnboardingProfileSnapshot } from "@/features/onboarding/types";
import { useOnboardingDocumentRequirements } from "@/features/onboarding/use-onboarding";
import type { AppRole } from "@/types/supplyed";

import { FileSummary, ReviewBadgeList } from "./ReviewCard";
import { stepContent, unselectedSteps } from "./constants";
import type {
  DocumentErrors,
  DocumentPreview,
  OnboardingDocumentDownloadActionResult,
  OnboardingDocumentUploadActionResult,
  OnboardingFinishResult,
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
    documents: snapshot.documents,
    institution: snapshot.institution,
    instructor: snapshot.instructor,
    recruiter: snapshot.recruiter,
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

export function useOnboardingForm({
  accountEmail,
  initialSnapshot,
  onFinish,
  onDocumentView,
  onDocumentUpload,
  onStepSave,
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
  role: AppRole;
  roleSelected: boolean;
  setStep: (step: number) => void;
  step: number;
}) {
  const activeRole: SignupRole = role === "teacher" ? "teacher" : role === "individual" ? "individual" : "institution";
  const steps = useMemo(() => (roleSelected ? stepContent(activeRole) : unselectedSteps), [activeRole, roleSelected]);
  const currentStep = Math.min(steps.length, Math.max(1, step)) as SignupStep;
  const [form, setForm] = useState<SignupForm>(() => createInitialForm(accountEmail, initialSnapshot));
  const [errors, setErrors] = useState<SignupErrors>({});
  const [documentErrors, setDocumentErrors] = useState<DocumentErrors>({});
  const [pending, setPending] = useState<OnboardingPending>(null);
  const [uploadPending, setUploadPending] = useState<string | null>(null);
  const [viewPending, setViewPending] = useState<string | null>(null);
  const [documentPreview, setDocumentPreview] = useState<DocumentPreview | null>(null);
  const [submitError, setSubmitError] = useState<string>();
  const progress = Math.round((currentStep / steps.length) * 100);
  const isLastStep = currentStep === steps.length;
  const mountedRef = useRef(true);
  const previousStepRef = useRef(currentStep);
  const initialSnapshotFingerprint = useMemo(() => snapshotFingerprint(initialSnapshot), [initialSnapshot]);
  const previousSnapshotFingerprintRef = useRef(initialSnapshotFingerprint);

  // Only teachers have a documents step today. The list is seeded from the
  // server snapshot and refreshed from GET /document-requirements/profile.
  const documentRequirementsQuery = useOnboardingDocumentRequirements(activeRole, {
    enabled: roleSelected && activeRole === "teacher",
    initialData: initialSnapshot?.documentRequirements,
  });
  const documentRequirements = useMemo(() => documentRequirementsQuery.data ?? [], [documentRequirementsQuery.data]);
  const documentRequirementsLoading = documentRequirementsQuery.isLoading;
  const documentRequirementsError = documentRequirementsQuery.isError
    ? documentRequirementsQuery.error instanceof Error && documentRequirementsQuery.error.message
      ? documentRequirementsQuery.error.message
      : "Document requirements could not be loaded."
    : undefined;

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
  }, [accountEmail, initialSnapshot, initialSnapshotFingerprint]);

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
              label: requirement.isRequired ? requirement.name : `${requirement.name} (optional)`,
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
        },
        {
          title: "Required Documents",
          description: "Documents sent to verification review",
          icon: "shield",
          editStep: 2,
          lines: documentLines,
        },
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
    void documentRequirementsQuery.refetch();
  }

  async function uploadDocument(requirement: OnboardingDocumentRequirement, file: UploadedFile) {
    if (pending === "submit" || uploadPending) return;

    const selectedFile = file.file;

    if (!selectedFile) {
      setDocumentError(requirement.id, `${requirement.name} is required.`);
      return;
    }

    const validationError = documentFileValidationError(file, requirement);
    if (validationError) {
      setDocumentError(requirement.id, validationError);
      return;
    }

    const data = new FormData();
    data.set("requirementId", requirement.id);
    data.set("role", activeRole);
    data.set("file", selectedFile, file.name);

    const previousFile = form.documents[requirement.id] ?? null;

    setForm((current) => ({
      ...current,
      documents: { ...current.documents, [requirement.id]: { ...file, requirementId: requirement.id } },
    }));
    clearDocumentError(requirement.id);
    setUploadPending(requirement.id);

    try {
      const result = await onDocumentUpload(data);

      if (!result.ok || !result.data?.document) {
        setForm((current) => ({ ...current, documents: { ...current.documents, [requirement.id]: previousFile } }));
        setDocumentError(requirement.id, result.message || `${requirement.name} could not be uploaded. Choose the file again.`);
        return;
      }

      const uploadedFile = toUploadedFileFromDocument(result.data.document);
      const uploadedDocuments = uploadedFilesFromSnapshot(result.data.documents);

      setForm((current) => ({
        ...current,
        documents: { ...current.documents, ...uploadedDocuments, [requirement.id]: uploadedFile },
      }));
      setDocumentError(requirement.id, undefined);
    } catch (error) {
      setForm((current) => ({ ...current, documents: { ...current.documents, [requirement.id]: previousFile } }));
      setDocumentError(
        requirement.id,
        error instanceof Error && error.message ? error.message : `${requirement.name} could not be uploaded. Choose the file again.`,
      );
    } finally {
      if (mountedRef.current) setUploadPending(null);
    }
  }

  async function viewDocument(requirementId: string, file: UploadedFile | null) {
    if (!file?.id || viewPending) return;

    const data = new FormData();
    data.set("documentId", file.id);
    data.set("fileName", file.name);
    setViewPending(requirementId);
    setSubmitError(undefined);

    try {
      const result = await onDocumentView(data);

      if (!result.ok || !result.data?.url) {
        setDocumentError(requirementId, result.message || "This document could not be opened.");
        return;
      }

      setDocumentPreview({
        expiresAt: result.data.expiresAt,
        file,
        url: result.data.url,
      });
    } catch (error) {
      setDocumentError(requirementId, error instanceof Error && error.message ? error.message : "This document could not be opened.");
    } finally {
      if (mountedRef.current) setViewPending(null);
    }
  }

  function closeDocumentPreview() {
    setDocumentPreview(null);
  }

  function clearFieldError(field: keyof SignupErrors) {
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError(undefined);
  }

  function applySnapshot(snapshot?: OnboardingProfileSnapshot) {
    if (!snapshot) return;
    setForm((current) => mergeSnapshotForm(current, accountEmail, snapshot));
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

    if (targetStep === 2 && activeRole === "teacher") {
      const nextDocumentErrors: DocumentErrors = {};

      if (documentRequirementsQuery.isError) {
        nextErrors.documents = "Document requirements could not be loaded. Retry, then continue.";
      } else if (!documentRequirementsQuery.isSuccess && documentRequirements.length === 0) {
        nextErrors.documents = "Document requirements are still loading. Try again in a moment.";
      } else {
        documentRequirements.forEach((requirement) => {
          const error = documentFileError(form.documents[requirement.id] ?? null, requirement);
          if (error) nextDocumentErrors[requirement.id] = error;
        });

        if (Object.keys(nextDocumentErrors).length > 0) {
          nextErrors.documents = "Upload the required documents before continuing.";
        }
      }

      setDocumentErrors(nextDocumentErrors);
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
    if (pending || uploadPending) return;
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
    if (pending || uploadPending) return;
    for (let targetStep = 1; targetStep < steps.length; targetStep += 1) {
      if (!validateStep(targetStep as SignupStep)) {
        setStep(targetStep);
        return;
      }
    }

    setPending("submit");
    setSubmitError(undefined);

    try {
      const result = await onFinish(buildPayload());
      if (!result.ok) {
        setSubmitError(result.message || "Onboarding could not be submitted. Try again.");
        return;
      }

      applySnapshot(result.data?.snapshot);
    } catch (error) {
      setSubmitError(error instanceof Error && error.message ? error.message : "Onboarding could not be submitted. Try again.");
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
    pending,
    progress,
    retryDocumentRequirements,
    reviewGroups,
    setStep,
    steps,
    submitError,
    submitSignup,
    uploadDocument,
    uploadPending,
    updateField,
    viewDocument,
    viewPending,
  };
}

export type OnboardingFormController = ReturnType<typeof useOnboardingForm>;
