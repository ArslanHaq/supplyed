"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { actualSubjects, catalogueError } from "@/features/teaching-catalogue/selection";
import { teachingCatalogueKey, useTeachingCatalogue } from "@/features/teaching-catalogue/use-teaching-catalogue";
import { Country } from "country-state-city";

import { useCurrentUser } from "@/features/auth/use-current-user";
import { usePhoneVerificationPending } from "@/features/auth/use-phone-verification";
import { filterProfileDocumentRequirements } from "@/features/onboarding/document-requirements";
import { missingRequiredDocuments } from "@/features/onboarding/document-utils";
import { useOnboardingDocumentRequirements, useOnboardingSnapshot } from "@/features/onboarding/use-onboarding";
import type {
  OnboardingDocumentRequirementSnapshot,
  OnboardingDocumentSnapshot,
  OnboardingProfileSnapshot,
} from "@/features/onboarding/types";
import type { AppRole } from "@/types/supplyed";
import { validateUkPhone } from "@/lib/uk-validation";

import { FileSummary, ReviewBadgeList } from "./ReviewCard";
import { stepContent, unselectedSteps } from "./constants";
import { validateOnboardingStep } from "./validation";
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
} from "./utils";


function snapshotFingerprint(snapshot?: OnboardingProfileSnapshot) {
  if (!snapshot) return "";

  return JSON.stringify({
    documentRequirements: snapshot.documentRequirements,
    documents: snapshot.documents,
    institution: snapshot.institution,
    instructor: snapshot.instructor,
    requirementDocuments: snapshot.requirementDocuments,
    role: snapshot.role,
    signatoryApproval: snapshot.signatoryApproval,
    user: snapshot.user,
  });
}

function countryLabel(countryCode: string) {
  if (!countryCode.trim()) return "Not provided";
  return Country.getCountryByCode(countryCode)?.name ?? countryCode;
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
  return false;
}

function missingSnapshotDocumentRequirements(snapshot: OnboardingProfileSnapshot | undefined, role: SignupRole) {
  if (!snapshot) return [];

  return missingRequiredDocuments(
    filterProfileDocumentRequirements(snapshot.documentRequirements ?? [], role),
    snapshot.requirementDocuments ?? {},
  );
}

function requirementErrorEntries(requirements: OnboardingDocumentRequirementSnapshot[]) {
  return Object.fromEntries(requirements.map((requirement) => [requirement.id, `${requirement.documentType.name} is required.`]));
}

function mergeSnapshotForm(current: SignupForm, accountEmail: string | undefined, snapshot?: OnboardingProfileSnapshot, preservePhone = false) {
  if (!snapshot) return current;

  const next = createInitialForm(accountEmail, snapshot);

  return {
    ...current,
    bio: snapshotString(current.bio, next.bio),
    complianceContact: snapshotString(current.complianceContact, next.complianceContact),
    complianceEmail: snapshotString(current.complianceEmail, next.complianceEmail),
    contactRole: snapshotString(current.contactRole, next.contactRole),
    coverTypes: snapshotStringArray(current.coverTypes, next.coverTypes),
    currency: snapshot.instructor?.currency || current.currency || "GBP",
    dailyRate: snapshotString(current.dailyRate, next.dailyRate),
    documents: { ...current.documents, ...next.documents },
    email: snapshotString(current.email, next.email),
    fullName: snapshotString(current.fullName, next.fullName),
    hourlyRate: snapshotString(current.hourlyRate, next.hourlyRate),
    institutionAddress: snapshotString(current.institutionAddress, next.institutionAddress),
    institutionCity: snapshotString(current.institutionCity, next.institutionCity),
    institutionCountryCode: snapshot.institution?.countryCode || current.institutionCountryCode || "GB",
    institutionDomain: snapshotString(current.institutionDomain, next.institutionDomain),
    institutionProfileId: snapshotString(current.institutionProfileId, next.institutionProfileId),
    institutionRegistrationId: snapshotString(current.institutionRegistrationId, next.institutionRegistrationId),
    institutionType: snapshot.institution?.institutionType ?? current.institutionType,
    keyStages: snapshotStringArray(current.keyStages, next.keyStages),
    localAuthority: snapshotString(current.localAuthority, next.localAuthority),
    maxTravelDistance: snapshotString(current.maxTravelDistance, next.maxTravelDistance),
    phone: preservePhone ? current.phone : snapshotString(current.phone, next.phone),
    profileCity: snapshotString(current.profileCity, next.profileCity),
    profileCountryCode: snapshot.instructor?.countryCode || current.profileCountryCode || "GB",
    postcode: snapshotString(current.postcode, next.postcode),
    schoolName: snapshotString(current.schoolName, next.schoolName),
    safeguardingConfirmed: current.safeguardingConfirmed || next.safeguardingConfirmed,
    skills: snapshotStringArray(current.skills, next.skills),
    otherSkills: next.skills.length ? undefined : current.otherSkills,
    staffingNeeds: snapshotStringArray(current.staffingNeeds, next.staffingNeeds),
    signatoryEmail: snapshotString(current.signatoryEmail, next.signatoryEmail),
    signatoryJobTitle: snapshotString(current.signatoryJobTitle, next.signatoryJobTitle),
    signatoryName: snapshotString(current.signatoryName, next.signatoryName),
    subjects: snapshotStringArray(current.subjects, next.subjects),
    otherSubjects: (snapshot.role === "teacher" ? next.subjects.length : next.staffingNeeds.length) ? undefined : current.otherSubjects,
    teacherProfileId: snapshotString(current.teacherProfileId, next.teacherProfileId),
    typicalPupilCount: snapshotString(current.typicalPupilCount, next.typicalPupilCount),
    trustCompanyNumber: snapshotString(current.trustCompanyNumber, next.trustCompanyNumber),
    trustName: snapshotString(current.trustName, next.trustName),
    yearsExperience: snapshotString(current.yearsExperience, next.yearsExperience),
  };
}

function fillEmpty(current: string, next?: string) {
  return current.trim() ? current : next?.trim() ?? current;
}

function fillEmptyArray(current: string[], next?: string[]) {
  return current.length > 0 ? current : next ?? current;
}

function mergePrefillForm(current: SignupForm, prefill?: OnboardingPrefill, snapshot?: OnboardingProfileSnapshot) {
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
    institutionCountryCode: snapshot?.institution?.countryCode ?? prefill.institutionCountryCode ?? current.institutionCountryCode,
    institutionDomain: fillEmpty(current.institutionDomain, prefill.institutionDomain),
    keyStages: fillEmptyArray(current.keyStages, prefill.keyStages),
    localAuthority: fillEmpty(current.localAuthority, prefill.localAuthority),
    maxTravelDistance: fillEmpty(current.maxTravelDistance, prefill.maxTravelDistance),
    phone: fillEmpty(current.phone, prefill.phone),
    profileCity: fillEmpty(current.profileCity, prefill.profileCity),
    profileCountryCode: snapshot?.instructor?.countryCode ?? prefill.profileCountryCode ?? current.profileCountryCode,
    postcode: fillEmpty(current.postcode, prefill.postcode),
    schoolName: fillEmpty(current.schoolName, prefill.schoolName),
    skills: fillEmptyArray(current.skills, prefill.skills),
    staffingNeeds: current.staffingNeeds.length ? current.staffingNeeds : prefill.staffingNeeds ?? [],
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
  const queryClient = useQueryClient();
  const catalogue = useTeachingCatalogue();
  const activeRole: SignupRole = role === "teacher" ? "teacher" : "institution";
  const steps = useMemo(() => (roleSelected ? stepContent(activeRole) : unselectedSteps), [activeRole, roleSelected]);
  const requestedStep = Math.min(steps.length, Math.max(1, Number.isFinite(step) ? Math.trunc(step) : 1)) as SignupStep;
  const [form, setForm] = useState<SignupForm>(() => mergePrefillForm(createInitialForm(accountEmail, initialSnapshot), prefill, initialSnapshot));
  const currentUserQuery = useCurrentUser();
  const phoneVerificationPending = usePhoneVerificationPending();
  const phoneTouchedRef = useRef(false);
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
    () => hasCreatedProfile(initialSnapshot, activeRole),
  );
  const navigation = useMemo(() => {
    if (!lockedDocumentStage) {
      for (let index = 1; index < requestedStep; index += 1) {
        const invalid = validateOnboardingStep(form, activeRole, index as SignupStep, roleSelected, accountEmail);
        if (Object.keys(invalid).length) return { step: index as SignupStep, errors: invalid };
      }
    }
    return { step: requestedStep, errors: undefined };
  }, [form, activeRole, requestedStep, roleSelected, accountEmail, lockedDocumentStage]);
  const currentStep = navigation.step;
  const [requirementDocuments, setRequirementDocuments] = useState<Record<string, OnboardingDocumentSnapshot>>(() => initialSnapshot?.requirementDocuments ?? {});
  const [requirementDocumentErrors, setRequirementDocumentErrors] = useState<Record<string, string | undefined>>({});
  const [pendingRequirementIds, setPendingRequirementIds] = useState<Set<string>>(() => new Set());
  const requirementUploadPending = pendingRequirementIds.size > 0;
  const pendingRequirementIdsRef = useRef(new Set<string>());
  const [requirementViewPending, setRequirementViewPending] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string>();
  const [signatoryApproval, setSignatoryApproval] = useState(initialSnapshot?.signatoryApproval ?? null);
  const [statusStage, setStatusStage] = useState(false);
  const progress = Math.round((currentStep / steps.length) * 100);
  const isLastStep = currentStep === steps.length;
  const mountedRef = useRef(true);
  const mutationPendingRef = useRef(false);
  const previousStepRef = useRef(currentStep);
  const initialSnapshotFingerprint = useMemo(() => snapshotFingerprint(initialSnapshot), [initialSnapshot]);
  const requirementsQuery = useOnboardingDocumentRequirements(activeRole, { enabled: roleSelected });
  const onboardingStatusQuery = useOnboardingSnapshot(accountEmail ?? "", {
    enabled: Boolean(accountEmail && lockedDocumentStage && activeRole === "institution" && form.institutionType === "MAT_SCHOOL"),
  });
  const documentRequirements = filterProfileDocumentRequirements(
    requirementsQuery.data?.map((requirement) => ({
      id: requirement.id,
      context: requirement.context,
      isRequired: requirement.isRequired,
      requiresReview: requirement.requiresReview,
      documentType: {
        allowedMimes: requirement.allowedMimes,
        code: requirement.code,
        maxSizeBytes: requirement.maxSizeBytes,
        name: requirement.name,
      },
    })) ?? documentRequirementsSnapshot, activeRole,
  );
  const previousSnapshotFingerprintRef = useRef(initialSnapshotFingerprint);
  const prefillFingerprint = useMemo(() => JSON.stringify(prefill ?? {}), [prefill]);
  const previousPrefillFingerprintRef = useRef(prefillFingerprint);

  const documentRequirementsLoading = requirementsQuery.isPending || requirementsQuery.isFetching;
  const documentRequirementsError = requirementsQuery.error?.message;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (navigation.errors) {
      setErrors(navigation.errors);
      setStep(navigation.step);
    }
  }, [navigation, setStep]);

  useEffect(() => {
    if (previousStepRef.current === currentStep) return;

    previousStepRef.current = currentStep;
    setPending((current) => (current === "step" ? null : current));
  }, [currentStep]);

  useEffect(() => {
    if (previousSnapshotFingerprintRef.current === initialSnapshotFingerprint) return;

    previousSnapshotFingerprintRef.current = initialSnapshotFingerprint;
    setForm((current) => mergeSnapshotForm(current, accountEmail, initialSnapshot,
      phoneTouchedRef.current || currentUserQuery.data?.phoneVerified === true));
    if (initialSnapshot?.documentRequirements.length || !lockedDocumentStage) {
      setDocumentRequirementsSnapshot(initialSnapshot?.documentRequirements ?? []);
    }
    setRequirementDocuments(initialSnapshot?.requirementDocuments ?? {});
    setSignatoryApproval(initialSnapshot?.signatoryApproval ?? null);
    if (hasCreatedProfile(initialSnapshot, activeRole)) {
      setLockedDocumentStage(true);
    }
  }, [accountEmail, activeRole, currentUserQuery.data?.phoneVerified, initialSnapshot, initialSnapshotFingerprint, lockedDocumentStage]);

  useEffect(() => {
    const user = currentUserQuery.data;
    if (phoneTouchedRef.current || !user?.phoneVerified || !user.phone) return;
    // A newer server snapshot can contain a number verified in another tab.
    setForm((current) => ({ ...current, phone: user.phone! }));
  }, [currentUserQuery.data]);

  useEffect(() => {
    if (onboardingStatusQuery.data?.signatoryApproval !== undefined) {
      setSignatoryApproval(onboardingStatusQuery.data.signatoryApproval);
    }
  }, [onboardingStatusQuery.data?.signatoryApproval]);

  function buildPayload() {
    return buildOnboardingPayload(form, activeRole, currentStep, accountEmail, catalogue.data);
  }

  const reviewGroups = useMemo<ReviewGroup[]>(() => {
    const accountLines: ReviewLine[] = [
      { label: "Account type", value: roleLabel(activeRole) },
      { label: "Name", value: form.fullName || "Not provided" },
      { label: "Email", value: form.email || accountEmail || "Not provided" },
      { label: "Phone", value: form.phone || "Not provided" },
      ...(activeRole === "teacher"
        ? [
            { label: "Country", value: countryLabel(form.profileCountryCode) },
            { label: "City", value: form.profileCity || "Not provided" },
            { label: "Postal code", value: form.postcode || "Not provided" },
          ]
        : []),
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
            { label: "Subjects", value: <ReviewBadgeList items={actualSubjects(form.subjects, form.otherSubjects)} />, wide: true },
            { label: "Key stages", value: <ReviewBadgeList items={form.keyStages} />, wide: true },
            { label: "Skills", value: <ReviewBadgeList items={actualSubjects(form.skills, form.otherSkills)} />, wide: true },
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
          { label: "School type", value: form.institutionType === "MAT_SCHOOL" ? "Multi-academy trust school" : "Single school" },
          ...(form.institutionType === "MAT_SCHOOL"
            ? [
                { label: "Trust", value: form.trustName || "Not provided" },
                { label: "Company number", value: form.trustCompanyNumber || "Optional" },
              ]
            : []),
          { label: "Your role", value: form.contactRole || "Not provided" },
          { label: "Domain", value: form.institutionDomain || "Not provided" },
          { label: "Address", value: form.institutionAddress || "Not provided", wide: true },
          { label: "Postal code", value: form.postcode || "Not provided" },
          { label: "Country", value: countryLabel(form.institutionCountryCode) },
          { label: "City", value: form.institutionCity || "Not provided" },
          { label: "Registration ID", value: form.institutionRegistrationId || "Optional" },
          { label: "Pupil count", value: form.typicalPupilCount || "Optional" },
          { label: "Cover types", value: <ReviewBadgeList items={form.coverTypes} />, wide: true },
          { label: "Staffing needs", value: <ReviewBadgeList items={actualSubjects(form.staffingNeeds, form.otherSubjects)} />, wide: true },
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
          ...(form.institutionType === "MAT_SCHOOL"
            ? [
                { label: "Trust signatory", value: form.signatoryName || "Not provided" },
                { label: "Signatory email", value: form.signatoryEmail || "Not provided" },
                { label: "Signatory role", value: form.signatoryJobTitle || "Not provided" },
              ]
            : []),
        ],
      },
    ];
  }, [accountEmail, activeRole, documentRequirements, form]);

  function updateField<FieldName extends keyof SignupForm>(field: FieldName, value: SignupForm[FieldName]) {
    if (field === "phone") phoneTouchedRef.current = true;
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      const nextForm = { ...form, [field]: value };
      const remaining = Object.assign({}, ...[1, 2, 3].map((target) => validateOnboardingStep(nextForm, activeRole, target as SignupStep, roleSelected, accountEmail)));
      const key = field as keyof SignupErrors;
      return { ...current, [key]: current[key] ? remaining[key] : undefined };
    });
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
    void requirementsQuery.refetch();
  }

  async function uploadDocument(requirement: OnboardingDocumentRequirementSnapshot, file: UploadedFile) {
    await uploadRequirementDocument(requirement.id, file);
  }

  async function viewDocument(requirementId: string, file: UploadedFile | null) {
    await viewRequirementDocument(requirementId, file);
  }

  async function uploadRequirementDocument(requirementId: string, file: UploadedFile) {
    if (mutationPendingRef.current || pendingRequirementIdsRef.current.has(requirementId) || !lockedDocumentStage) return;

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

    // Uploads need only the requirement and file; profile fields exceed the multipart field limit.
    const data = new FormData();
    data.set("requirementId", requirementId);
    data.set("file", selectedFile!, file.name);

    setRequirementDocumentErrors((current) => ({ ...current, [requirementId]: undefined }));
    setSubmitError(undefined);
    pendingRequirementIdsRef.current.add(requirementId);
    setPendingRequirementIds(new Set(pendingRequirementIdsRef.current));

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
      pendingRequirementIdsRef.current.delete(requirementId);
      if (mountedRef.current) setPendingRequirementIds(new Set(pendingRequirementIdsRef.current));
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

  function applySnapshot(snapshot?: OnboardingProfileSnapshot) {
    if (!snapshot) return;
    setForm((current) => mergeSnapshotForm(current, accountEmail, snapshot,
      phoneTouchedRef.current || currentUserQuery.data?.phoneVerified === true));
    setDocumentRequirementsSnapshot(snapshot.documentRequirements);
    setRequirementDocuments(snapshot.requirementDocuments ?? {});
    setSignatoryApproval(snapshot.signatoryApproval ?? null);
  }

  function validateStep(targetStep: SignupStep) {
    const nextErrors = validateOnboardingStep(form, activeRole, targetStep, roleSelected, accountEmail);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 && typeof document !== "undefined") {
      requestAnimationFrame(() => document.querySelector<HTMLElement>(".onboarding-canvas [aria-invalid='true']")?.focus());
    }
    return Object.keys(nextErrors).length === 0;
  }

  function validateThrough(targetStep: number, unlockForCorrection = false) {
    for (let index = 1; index <= Math.min(targetStep, steps.length - 1); index += 1) {
      if (!validateStep(index as SignupStep)) {
        if (unlockForCorrection) {
          setLockedDocumentStage(false);
          setStatusStage(false);
          setSubmitError("Update the highlighted profile details before continuing. Your existing profile and uploaded documents are preserved.");
        }
        setStep(index);
        return false;
      }
    }
    return true;
  }

  function navigateStep(nextStep: number) {
    if (lockedDocumentStage || mutationPendingRef.current || phoneVerificationPending) return;
    const target = Math.max(1, Math.min(steps.length, nextStep));
    if (target > currentStep && !validateThrough(target - 1)) return;
    setStep(target);
  }

  function applyServerFieldErrors(result: OnboardingFinishResult, allowCorrection = false) {
    if (!result.fieldErrors || !Object.keys(result.fieldErrors).length) return;
    setErrors(result.fieldErrors);
    if (!lockedDocumentStage || allowCorrection) {
      const fields = Object.keys(result.fieldErrors);
      const target = activeRole === "teacher" || fields.some((key) => ["accountRole", "fullName", "phone", "email"].includes(key))
        ? 1
        : fields.some((key) => !["complianceContact", "complianceEmail", "safeguardingConfirmed", "signatoryName", "signatoryEmail", "signatoryJobTitle"].includes(key)) ? 2 : 3;
      if (allowCorrection) { setLockedDocumentStage(false); setStatusStage(false); }
      setStep(target);
    }
    requestAnimationFrame(() => document.querySelector<HTMLElement>(".onboarding-canvas [aria-invalid='true']")?.focus());
  }

  async function continueStep() {
    if (lockedDocumentStage || mutationPendingRef.current || phoneVerificationPending) return;
    if (!validateThrough(currentStep)) return;

    mutationPendingRef.current = true;
    setPending("step");
    setSubmitError(undefined);

    try {
      const result = await onStepSave(buildPayload());
      if (!result.ok) {
        if (catalogueError(result.code)) void queryClient.invalidateQueries({ queryKey: ["dropdown"] });
        applyServerFieldErrors(result);
        setSubmitError(result.message || "This step could not be saved. Try again.");
        return;
      }

      applySnapshot(result.data?.snapshot);
      setStep(currentStep + 1);
      setErrors({});
    } catch (error) {
      setSubmitError(error instanceof Error && error.message ? error.message : "This step could not be saved. Try again.");
    } finally {
      mutationPendingRef.current = false;
      if (mountedRef.current) setPending(null);
    }
  }

  async function submitSignup() {
    if (lockedDocumentStage || mutationPendingRef.current || phoneVerificationPending) return;
    if (!validateThrough(steps.length - 1)) return;
    const savedPhone = validateUkPhone(currentUserQuery.data?.phone ?? initialSnapshot?.user?.phone, { required: true });
    const currentPhone = validateUkPhone(form.phone, { required: true });
    const savedPhoneVerified = currentUserQuery.data?.phoneVerified ?? initialSnapshot?.user?.phoneVerified;
    if ((form.teacherProfileId || form.institutionProfileId || savedPhoneVerified) &&
      (!savedPhone.valid || (savedPhoneVerified && savedPhone.value !== currentPhone.value))) {
      setErrors({ phone: "Verify this UK phone number before saving the profile." });
      setStep(1);
      return;
    }

    mutationPendingRef.current = true;
    setPending("submit");
    setSubmitError(undefined);

    try {
      const payload = buildPayload();
      payload.set("intent", "profile");

      const result = await onFinish(payload);
      const snapshot = result.data?.snapshot;
      applySnapshot(snapshot);
      if (hasCreatedProfile(snapshot, activeRole)) {
        setLockedDocumentStage(true);
        setRequirementDocumentErrors({});
      }

      if (!result.ok) {
        if (catalogueError(result.code)) void queryClient.invalidateQueries({ queryKey: ["dropdown"] });
        applyServerFieldErrors(result);
        setSubmitError(result.message || "Onboarding could not be submitted. Try again.");
      }
    } catch (error) {
      setSubmitError(error instanceof Error && error.message ? error.message : "Onboarding could not be submitted. Try again.");
    } finally {
      mutationPendingRef.current = false;
      if (mountedRef.current) setPending(null);
    }
  }

  async function submitDocumentsForReview() {
    if (!lockedDocumentStage || mutationPendingRef.current || pendingRequirementIdsRef.current.size > 0) return;
    if (!validateThrough(steps.length - 1, true)) return;
    if (documentRequirementsLoading || documentRequirementsError) {
      setSubmitError("Wait for the document requirements to load, or retry the check before submitting.");
      return;
    }

    const missingRequirements = missingRequiredDocuments(documentRequirements, requirementDocuments);
    if (missingRequirements.length > 0) {
      setRequirementDocumentErrors((current) => ({
        ...current,
        ...requirementErrorEntries(missingRequirements),
      }));
      setSubmitError("Upload all required documents before sending the profile for review.");
      return;
    }

    mutationPendingRef.current = true;
    setPending("submit");
    setSubmitError(undefined);

    try {
      const payload = buildPayload();
      payload.set("intent", "review");

      const result = await onFinish(payload);
      if (!result.ok) {
        if (catalogueError(result.code)) void queryClient.invalidateQueries({ queryKey: ["dropdown"] });
        applyServerFieldErrors(result, true);
        void requirementsQuery.refetch();
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
      } else if (result.data?.applicationStatus === "none") {
        const waitingForTrust = activeRole === "institution" && snapshot?.institution?.institutionType === "MAT_SCHOOL" && snapshot.signatoryApproval?.status !== "APPROVED";
        if (waitingForTrust) {
          setStatusStage(true);
          setSubmitError(undefined);
        } else {
          setSubmitError(result.message || "This profile is not ready to be submitted for review yet.");
        }
      }
    } catch (error) {
      setSubmitError(error instanceof Error && error.message ? error.message : "Profile could not be sent for review. Try again.");
    } finally {
      mutationPendingRef.current = false;
      if (mountedRef.current) setPending(null);
    }
  }

  async function refreshSignatoryApproval() {
    if (mutationPendingRef.current || pendingRequirementIdsRef.current.size > 0) return;
    mutationPendingRef.current = true;
    setPending("status");
    setSubmitError(undefined);

    try {
      const result = await onboardingStatusQuery.refetch();
      if (result.error) throw result.error;
      setSignatoryApproval(result.data?.signatoryApproval ?? null);
    } catch (error) {
      setSubmitError(error instanceof Error && error.message ? error.message : "Trust approval status could not be checked.");
    } finally {
      mutationPendingRef.current = false;
      if (mountedRef.current) setPending(null);
    }
  }

  async function requestSignatoryApproval() {
    if (!lockedDocumentStage || activeRole !== "institution" || form.institutionType !== "MAT_SCHOOL" || mutationPendingRef.current || pendingRequirementIdsRef.current.size > 0) return;
    if (!validateStep(3)) return;

    mutationPendingRef.current = true;
    setPending("submit");
    setSubmitError(undefined);

    try {
      const payload = buildPayload();
      payload.set("intent", "signatory");
      const result = await onFinish(payload);
      applySnapshot(result.data?.snapshot);
      if (!result.ok) {
        if (catalogueError(result.code)) void queryClient.invalidateQueries({ queryKey: ["dropdown"] });
        applyServerFieldErrors(result, Object.keys(result.fieldErrors ?? {}).some((key) => !key.startsWith("signatory")));
        setSubmitError(result.message || "The trust approval request could not be sent.");
      }
    } catch (error) {
      setSubmitError(error instanceof Error && error.message ? error.message : "The trust approval request could not be sent.");
    } finally {
      mutationPendingRef.current = false;
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
    phoneVerificationPending,
    phoneVerified: currentUserQuery.data?.phoneVerified ?? initialSnapshot?.user?.phoneVerified ?? false,
    savedPhone: currentUserQuery.data?.phone ?? initialSnapshot?.user?.phone ?? "",
    progress,
    requirementDocumentErrors,
    requirementDocuments,
    requirementUploadPending,
    pendingRequirementIds,
    requirementViewPending,
    refreshSignatoryApproval,
    requestSignatoryApproval,
    reviewGroups,
    signatoryApproval,
    statusStage,
    returnToDocuments: () => setStatusStage(false),
    retryDocumentRequirements,
    setStep: navigateStep,
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
