"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { OnboardingProfileSnapshot } from "@/features/onboarding/types";
import type { AppRole } from "@/types/supplyed";

import { FileSummary, ReviewBadgeList } from "./ReviewCard";
import { stepContent, unselectedSteps } from "./constants";
import type {
  DocumentUploadField,
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
} from "./utils";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[0-9+()\s-]{10,}$/;
const domainPattern = /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,}$/i;

function mergeSnapshotForm(current: SignupForm, accountEmail: string | undefined, snapshot?: OnboardingProfileSnapshot) {
  if (!snapshot) return current;

  const next = createInitialForm(accountEmail, snapshot);

  return {
    ...current,
    ...next,
    dbsCertificateFile: next.dbsCertificateFile ?? current.dbsCertificateFile,
    identityPhoto: next.identityPhoto ?? current.identityPhoto,
    qualificationFile: next.qualificationFile ?? current.qualificationFile,
    rightToWorkFile: next.rightToWorkFile ?? current.rightToWorkFile,
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
  const [pending, setPending] = useState<OnboardingPending>(null);
  const [uploadPending, setUploadPending] = useState<DocumentUploadField | null>(null);
  const [viewPending, setViewPending] = useState<DocumentUploadField | null>(null);
  const [submitError, setSubmitError] = useState<string>();
  const progress = Math.round((currentStep / steps.length) * 100);
  const isLastStep = currentStep === steps.length;
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function buildPayload() {
    return buildOnboardingPayload(form, activeRole, currentStep, accountEmail);
  }

  const reviewGroups = useMemo<ReviewGroup[]>(() => {
    const accountLines: ReviewLine[] = [
      { label: "Account type", value: roleLabel(activeRole) },
      { label: "Name", value: form.fullName || "Not provided" },
      { label: "Email", value: form.email || accountEmail || "Not provided" },
      { label: "Phone", value: form.phone || "Not provided" },
      { label: "Postcode", value: form.postcode || "Not provided" },
    ];

    if (activeRole === "teacher") {
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
          description: "Documents sent to admin review",
          icon: "shield",
          editStep: 2,
          lines: [
            { label: "DBS number", value: form.dbsNumber || "Not provided" },
            { label: "Enhanced DBS certificate", value: <FileSummary file={form.dbsCertificateFile} />, wide: true },
            { label: "Photo ID", value: <FileSummary file={form.identityPhoto} />, wide: true },
            { label: "Teaching qualification / QTS", value: <FileSummary file={form.qualificationFile} />, wide: true },
            { label: "Proof of address", value: <FileSummary file={form.rightToWorkFile} />, wide: true },
          ],
        },
      ];
    }

    if (activeRole === "individual") {
      return [
        {
          title: "Account",
          description: "Login and contact details",
          icon: "user",
          editStep: 1,
          lines: accountLines,
        },
        {
          title: "Learner Request",
          description: "Subject, stage, and scheduling needs",
          icon: "heart",
          editStep: 2,
          lines: [
            { label: "Support for", value: form.individualRelationship || "Not provided" },
            { label: "Subjects", value: <ReviewBadgeList items={form.subjects} />, wide: true },
            { label: "Stage", value: <ReviewBadgeList items={form.keyStages} />, wide: true },
            { label: "Format", value: form.learningMode || "Not provided" },
            { label: "Schedule", value: form.preferredSchedule || "Not provided" },
            { label: "Budget", value: form.budgetRange || "Not provided" },
            { label: "Notes", value: form.learnerNotes || "Optional", wide: true },
          ],
        },
        {
          title: "Safeguarding",
          description: "Privacy and verified-teacher expectations",
          icon: "shield",
          editStep: 3,
          lines: [
            { label: "Hiring consent", value: form.individualConsent ? "Hiring responsibility confirmed" : "Not confirmed", wide: true },
            { label: "Platform safety", value: form.safeguardingConfirmed ? "Messaging and bookings stay inside SupplyED" : "Not confirmed", wide: true },
          ],
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
          { label: "Pupil count", value: form.yearsExperience || "Optional" },
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
  }, [accountEmail, activeRole, form]);

  function updateField<FieldName extends keyof SignupForm>(field: FieldName, value: SignupForm[FieldName]) {
    setForm((current) => ({
      ...current,
      ...(field === "dbsNumber" && value !== current.dbsNumber ? { dbsCertificateFile: null } : {}),
      [field]: value,
    }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError(undefined);
  }

  function documentKindForField(field: DocumentUploadField) {
    if (field === "dbsCertificateFile") return "dbs";
    if (field === "identityPhoto") return "id";
    if (field === "qualificationFile") return "qualification";
    return "addressProof";
  }

  function documentLabelForField(field: DocumentUploadField) {
    if (field === "dbsCertificateFile") return "Enhanced DBS certificate";
    if (field === "identityPhoto") return "Photo ID";
    if (field === "qualificationFile") return "Teaching qualification";
    return "Proof of address";
  }

  function documentErrorField(field: DocumentUploadField): keyof SignupErrors {
    return field;
  }

  async function uploadDocument(field: DocumentUploadField, file: UploadedFile) {
    if (pending || uploadPending) return;

    const label = documentLabelForField(field);
    const selectedFile = file.file;
    const validationError = selectedFile ? documentFileError({ ...file, id: "validation-placeholder" }, label) : `${label} is required.`;

    if (validationError) {
      setErrors((current) => ({ ...current, [documentErrorField(field)]: validationError }));
      return;
    }

    if (field === "dbsCertificateFile" && !form.dbsNumber.trim()) {
      setErrors((current) => ({
        ...current,
        dbsCertificateFile: "Enter your enhanced DBS certificate number before uploading this file.",
        dbsNumber: "Enter your enhanced DBS certificate number before uploading this file.",
      }));
      return;
    }

    const data = new FormData();
    data.set("kind", documentKindForField(field));
    data.set("dbsNumber", form.dbsNumber.trim());
    data.set("file", selectedFile!, file.name);

    setForm((current) => ({ ...current, [field]: file }));
    setErrors((current) => ({ ...current, [documentErrorField(field)]: undefined }));
    setSubmitError(undefined);
    setUploadPending(field);

    try {
      const result = await onDocumentUpload(data);

      if (!result.ok || !result.data?.document) {
        setErrors((current) => ({
          ...current,
          [documentErrorField(field)]: result.message || `${label} could not be uploaded. Choose the file again.`,
        }));
        return;
      }

      const uploadedFile = toUploadedFileFromDocument(result.data.document);
      const uploadedDocuments = result.data.documents;

      setForm((current) => ({
        ...current,
        dbsCertificateFile: uploadedDocuments.dbs ? toUploadedFileFromDocument(uploadedDocuments.dbs) : current.dbsCertificateFile,
        dbsNumber: uploadedDocuments.dbs?.dbsNumber ?? current.dbsNumber,
        identityPhoto: uploadedDocuments.id ? toUploadedFileFromDocument(uploadedDocuments.id) : current.identityPhoto,
        qualificationFile: uploadedDocuments.qualification
          ? toUploadedFileFromDocument(uploadedDocuments.qualification)
          : current.qualificationFile,
        rightToWorkFile: uploadedDocuments.addressProof
          ? toUploadedFileFromDocument(uploadedDocuments.addressProof)
          : current.rightToWorkFile,
        [field]: uploadedFile,
      }));
      setErrors((current) => ({ ...current, [documentErrorField(field)]: undefined }));
    } catch (error) {
      setErrors((current) => ({
        ...current,
        [documentErrorField(field)]:
          error instanceof Error && error.message ? error.message : `${label} could not be uploaded. Choose the file again.`,
      }));
    } finally {
      if (mountedRef.current) setUploadPending(null);
    }
  }

  async function viewDocument(field: DocumentUploadField, file: UploadedFile | null) {
    if (!file?.id || viewPending) return;

    const previewWindow = window.open("about:blank", "_blank");
    if (previewWindow) {
      previewWindow.opener = null;
      previewWindow.document.title = "Preparing document preview";
      previewWindow.document.body.textContent = "Preparing secure document preview...";
    }

    const data = new FormData();
    data.set("documentId", file.id);
    setViewPending(field);
    setSubmitError(undefined);

    try {
      const result = await onDocumentView(data);

      if (!result.ok || !result.data?.url) {
        previewWindow?.close();
        setErrors((current) => ({
          ...current,
          [documentErrorField(field)]: result.message || "This document could not be opened.",
        }));
        return;
      }

      if (previewWindow) {
        previewWindow.location.href = result.data.url;
      } else {
        window.location.assign(result.data.url);
      }
    } catch (error) {
      previewWindow?.close();
      setErrors((current) => ({
        ...current,
        [documentErrorField(field)]:
          error instanceof Error && error.message ? error.message : "This document could not be opened.",
      }));
    } finally {
      if (mountedRef.current) setViewPending(null);
    }
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
      if (!form.postcode.trim()) nextErrors.postcode = "Enter your postcode.";

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
      const dbsCertificateError = documentFileError(form.dbsCertificateFile, "Enhanced DBS certificate");
      const identityPhotoError = documentFileError(form.identityPhoto, "Photo ID");
      const qualificationFileError = documentFileError(form.qualificationFile, "Teaching qualification");
      const rightToWorkFileError = documentFileError(form.rightToWorkFile, "Proof of address");

      if (!form.dbsNumber.trim()) nextErrors.dbsNumber = "Enter your enhanced DBS certificate number.";
      if (dbsCertificateError) nextErrors.dbsCertificateFile = dbsCertificateError;
      if (identityPhotoError) nextErrors.identityPhoto = identityPhotoError;
      if (qualificationFileError) nextErrors.qualificationFile = qualificationFileError;
      if (rightToWorkFileError) nextErrors.rightToWorkFile = rightToWorkFileError;
    }

    if (targetStep === 2 && activeRole === "individual") {
      if (!form.individualRelationship) nextErrors.individualRelationship = "Choose who needs support.";
      if (form.subjects.length === 0) nextErrors.subjects = "Choose at least one subject.";
      if (form.keyStages.length === 0) nextErrors.keyStages = "Choose the learner stage.";
      if (!form.learningMode) nextErrors.learningMode = "Choose online, in-person, or hybrid support.";
      if (!form.preferredSchedule) nextErrors.preferredSchedule = "Choose a preferred schedule.";
      if (!form.budgetRange) nextErrors.budgetRange = "Choose a budget range.";
    }

    if (targetStep === 3 && activeRole === "institution") {
      if (!form.complianceContact.trim()) nextErrors.complianceContact = "Enter the safeguarding or compliance lead.";
      if (!form.complianceEmail.trim()) nextErrors.complianceEmail = "Enter the compliance email.";
      else if (!emailPattern.test(form.complianceEmail.trim())) nextErrors.complianceEmail = "Use a valid email address.";
      if (!form.safeguardingConfirmed) nextErrors.safeguardingConfirmed = "Confirm safeguarding responsibility.";
    }

    if (targetStep === 3 && activeRole === "individual") {
      if (!form.individualConsent) nextErrors.individualConsent = "Confirm you are authorised to arrange learning support.";
      if (!form.safeguardingConfirmed) nextErrors.safeguardingConfirmed = "Confirm communication will stay inside SupplyED.";
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
    clearFieldError,
    continueStep,
    currentStep,
    errors,
    form,
    isLastStep,
    pending,
    progress,
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
