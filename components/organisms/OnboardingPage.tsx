import { useState } from "react";

import type { OnboardingProfileSnapshot } from "@/features/onboarding/types";
import type { FoundingSignupType } from "@/lib/founding-signup-intent";
import type { AppRole } from "@/types/supplyed";

import { Btn, Icon, Logo, Tag } from "../atoms";
import { Modal } from "../molecules";
import type {
  OnboardingDocumentDownloadActionResult,
  OnboardingDocumentUploadActionResult,
  OnboardingFinishResult,
  OnboardingPrefill,
  SignupRole,
} from "./onboarding/types";
import { DocumentPreviewModal } from "./onboarding/DocumentPreviewModal";
import type { OnboardingFormController } from "./onboarding/useOnboardingForm";
import { useOnboardingForm } from "./onboarding/useOnboardingForm";
import { AccountBasicsStep } from "./onboarding/steps/AccountBasicsStep";
import { InstitutionComplianceStep } from "./onboarding/steps/InstitutionComplianceStep";
import { InstitutionDetailsStep } from "./onboarding/steps/InstitutionDetailsStep";
import { DocumentUploadStep } from "./onboarding/steps/DocumentUploadStep";
import { ReviewStep } from "./onboarding/steps/ReviewStep";
import { TeacherProfileStep } from "./onboarding/steps/TeacherProfileStep";
import {
  roleLabel,
  signupHeroCopy,
  signupHeroTitle,
  signupStepTitle,
  signupSubmitLabel,
} from "./onboarding/utils";

export function OnboardingPage({
  accountEmail,
  foundingType,
  headerActionLabel = "Log in",
  headerPrompt = "Already registered?",
  roleSelected,
  step,
  setStep,
  role,
  setRole,
  initialSnapshot,
  onFinish,
  onDocumentView,
  onDocumentUpload,
  onStepSave,
  prefill,
  onLanding,
  onLogin,
}: {
  accountEmail?: string;
  foundingType?: FoundingSignupType;
  headerActionLabel?: string;
  headerPrompt?: string;
  initialSnapshot?: OnboardingProfileSnapshot;
  roleSelected: boolean;
  step: number;
  setStep: (step: number) => void;
  role: AppRole;
  setRole: (role: SignupRole) => void;
  onFinish: (payload: FormData) => Promise<OnboardingFinishResult>;
  onDocumentView: (payload: FormData) => Promise<OnboardingDocumentDownloadActionResult>;
  onDocumentUpload: (payload: FormData) => Promise<OnboardingDocumentUploadActionResult>;
  onStepSave: (payload: FormData) => Promise<OnboardingFinishResult>;
  prefill?: OnboardingPrefill;
  onLanding: () => void;
  onLogin: () => void;
}) {
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);
  const controller = useOnboardingForm({
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
  });
  const {
    activeRole,
    closeDocumentPreview,
    continueStep,
    currentStep,
    documentPreview,
    isLastStep,
    lockedDocumentStage,
    pending,
    progress,
    requirementUploadPending,
    steps,
    submitDocumentsForReview,
    submitError,
    submitSignup,
    uploadPending,
  } = controller;
  const displayProgress = lockedDocumentStage ? 100 : progress;
  const pageTitle = lockedDocumentStage ? "Upload required documents" : roleSelected ? signupStepTitle(activeRole, currentStep) : "Choose account type";
  const pageDescription = lockedDocumentStage
    ? "Your profile has been created. Upload the admin-required documents before sending it for review."
    : steps[currentStep - 1].description;

  function closeConfirmCreate() {
    if (pending) return;
    setConfirmCreateOpen(false);
  }

  function handlePrimaryAction() {
    if (lockedDocumentStage) {
      void submitDocumentsForReview();
      return;
    }

    if (isLastStep) {
      setConfirmCreateOpen(true);
      return;
    }

    void continueStep();
  }

  function confirmCreateProfile() {
    setConfirmCreateOpen(false);
    void submitSignup();
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-chalk">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-white px-4 py-4 sm:px-6 lg:px-8">
        <Logo size={21} onClick={onLanding} />
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted sm:inline">{headerPrompt}</span>
          <Btn variant="secondary" size="sm" onClick={onLogin}>{headerActionLabel}</Btn>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-73px)] w-full max-w-[1720px] grid-cols-1 px-4 py-5 sm:px-6 sm:py-8 lg:grid-cols-[420px_minmax(0,1fr)] lg:items-stretch lg:px-10 xl:grid-cols-[440px_minmax(0,1fr)] 2xl:max-w-[1780px]">
        <aside className="relative overflow-hidden rounded-t-xl bg-[#0a0a0a] p-6 text-white shadow-panel sm:p-8 lg:rounded-l-xl lg:rounded-r-none">
          <div className="absolute inset-0 bg-[linear-gradient(rgb(var(--se-rgb)/0.08)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--se-rgb)/0.08)_1px,transparent_1px)] bg-[length:48px_48px]" />
          <div className="relative flex h-full flex-col">
            <div>
              <div className="eyebrow mb-5 text-brand">Join SupplyED</div>
              <h1 className="font-serif text-3xl leading-[1.08] sm:text-[40px]">
                {roleSelected ? signupHeroTitle(activeRole) : "Choose your SupplyED path."}
              </h1>
              <p className="mt-5 text-sm leading-7 text-white/65 sm:text-[15px]">
                {roleSelected
                  ? signupHeroCopy(activeRole)
                  : "Your email is verified. Now choose whether you are hiring talent, joining as a teacher, or setting up a school workspace."}
              </p>
            </div>

            {foundingType ? (
              <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="font-semibold text-white">
                  Founding {foundingType === "teacher" ? "teacher" : "school"} interest received
                </div>
                <p className="mt-1 text-sm leading-6 text-white/55">
                  We have carried across the details you already shared.
                </p>
              </div>
            ) : null}

            <div className="mt-8 space-y-4">
              {steps.map((item, index) => {
                const itemStep = index + 1;
                const active = !lockedDocumentStage && itemStep === currentStep;
                const complete = lockedDocumentStage || itemStep < currentStep;

                return (
                  <button
                    key={item.label}
                    className="flex w-full gap-3 text-left"
                    onClick={() => {
                      if (!lockedDocumentStage && itemStep < currentStep) setStep(itemStep);
                    }}
                    type="button"
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold"
                      style={{
                        background: complete ? "var(--se)" : active ? "#fff" : "transparent",
                        borderColor: complete || active ? "var(--se)" : "rgba(255,255,255,0.25)",
                        color: complete ? "#fff" : active ? "var(--ink)" : "rgba(255,255,255,0.55)",
                      }}
                    >
                      {complete ? <Icon name="check" size={14} /> : itemStep}
                    </span>
                    <span>
                      <span className={active ? "block font-semibold text-white" : "block font-medium text-white/70"}>{item.label}</span>
                      <span className="block text-xs text-white/45">{item.description}</span>
                    </span>
                  </button>
                );
              })}
              {lockedDocumentStage ? (
                <div className="flex w-full gap-3 text-left">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand bg-white text-xs font-bold text-ink">
                    <Icon name="file" size={14} />
                  </span>
                  <span>
                    <span className="block font-semibold text-white">Required documents</span>
                    <span className="block text-xs text-white/45">Upload documents and send for review</span>
                  </span>
                </div>
              ) : null}
            </div>

            <div className="mt-auto hidden rounded-lg border border-white/10 bg-white/5 p-4 lg:block">
              <div className="text-xs uppercase tracking-[1px] text-white/45">Current path</div>
              <div className="mt-1 font-serif text-2xl">{lockedDocumentStage ? "Document review" : roleSelected ? roleLabel(activeRole) : "Role selection"}</div>
              <p className="mt-1 text-sm text-white/55">
                {lockedDocumentStage ? "Profile details are locked. Upload the required documents to continue." : "You can change this in the account step before submitting."}
              </p>
            </div>
          </div>
        </aside>

        <section className="flex min-h-[720px] flex-col rounded-b-xl border border-t-0 border-border bg-white p-5 shadow-(--shadow-xs) sm:p-8 lg:rounded-l-none lg:rounded-r-xl lg:border-l-0 lg:border-t xl:p-10 2xl:p-12">
          <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
            <div>
              <Tag>{lockedDocumentStage ? "Required documents" : `Step ${currentStep} of ${steps.length}`}</Tag>
              <h2 className="mt-3 font-serif text-3xl leading-tight sm:text-[36px]">
                {pageTitle}
              </h2>
              <p className="mt-2 max-w-[760px] text-muted">{pageDescription}</p>
            </div>
            <div className="w-full sm:w-[210px]">
              <div className="mb-2 flex justify-between text-xs font-semibold uppercase tracking-[1px] text-muted">
                <span>Progress</span>
                <span>{displayProgress}%</span>
              </div>
              <div className="progress">
                <div className="progress-fill" style={{ width: `${displayProgress}%` }} />
              </div>
            </div>
          </div>

          <div className="flex-1">
            {lockedDocumentStage ? (
              <DocumentUploadStep controller={controller} />
            ) : (
              <OnboardingStepContent
                accountEmail={accountEmail}
                controller={controller}
                roleSelected={roleSelected}
                setRole={setRole}
              />
            )}
          </div>

          {submitError ? (
            <div className="mt-6 rounded-xl border border-danger bg-danger-tint px-4 py-3 text-sm font-semibold text-danger">
              {submitError}
            </div>
          ) : null}

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            {lockedDocumentStage ? (
              <span className="text-sm font-semibold text-muted">Profile created. Previous onboarding steps are locked.</span>
            ) : (
              <Btn variant="ghost" disabled={currentStep === 1 || Boolean(pending)} onClick={() => setStep(Math.max(1, currentStep - 1))}>Back</Btn>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span className="self-center text-xs font-semibold uppercase tracking-[1px] text-muted">
                {lockedDocumentStage ? "Documents required before review" : "Saved on continue"}
              </span>
              <Btn
                loading={pending === "step" || pending === "submit"}
                loadingLabel={lockedDocumentStage ? "Sending for review" : isLastStep ? "Creating profile" : "Saving step"}
                size="lg"
                iconRight="arrow"
                disabled={Boolean(uploadPending || requirementUploadPending)}
                onClick={handlePrimaryAction}
              >
                {lockedDocumentStage ? "Send for review" : isLastStep ? signupSubmitLabel(activeRole) : "Continue"}
              </Btn>
            </div>
          </div>
        </section>
      </main>
      <Modal open={confirmCreateOpen} onClose={closeConfirmCreate}>
        <div className="p-6 sm:p-7">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand">
              <Icon name="checkCircle" size={20} />
            </div>
            <div>
              <div className="font-serif text-2xl leading-tight">Create this profile?</div>
              <p className="mt-2 text-sm leading-6 text-muted">
                Once you continue, this profile will be created and you will not be able to return to earlier onboarding steps. If documents are required by admin, you will upload them on the next screen before the profile is sent for review.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Btn variant="ghost" disabled={Boolean(pending)} onClick={closeConfirmCreate}>Review again</Btn>
            <Btn loading={pending === "submit"} loadingLabel="Creating profile" onClick={confirmCreateProfile}>Create profile</Btn>
          </div>
        </div>
      </Modal>
      <DocumentPreviewModal preview={documentPreview} onClose={closeDocumentPreview} />
    </div>
  );
}

function OnboardingStepContent({
  accountEmail,
  controller,
  roleSelected,
  setRole,
}: {
  accountEmail?: string;
  controller: OnboardingFormController;
  roleSelected: boolean;
  setRole: (role: SignupRole) => void;
}) {
  const { activeRole, currentStep, isLastStep } = controller;

  if (isLastStep) return <ReviewStep controller={controller} />;

  if (currentStep === 1) {
    if (!roleSelected) {
      return (
        <AccountBasicsStep
          accountEmail={accountEmail}
          controller={controller}
          roleSelected={roleSelected}
          setRole={setRole}
        />
      );
    }

    if (activeRole === "teacher") {
      return (
        <TeacherProfileStep
          accountEmail={accountEmail}
          controller={controller}
          roleSelected={roleSelected}
          setRole={setRole}
        />
      );
    }

    return (
      <AccountBasicsStep
        accountEmail={accountEmail}
        controller={controller}
        roleSelected={roleSelected}
        setRole={setRole}
      />
    );
  }

  if (currentStep === 2) {
    return <InstitutionDetailsStep controller={controller} />;
  }

  if (currentStep === 3) {
    if (activeRole === "institution") return <InstitutionComplianceStep controller={controller} />;
  }

  return null;
}
