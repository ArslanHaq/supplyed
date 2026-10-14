import { useState } from "react";

import type { OnboardingProfileSnapshot } from "@/features/onboarding/types";
import type { FoundingSignupType } from "@/lib/founding-signup-intent";
import type { AppRole } from "@/types/supplyed";

import { Btn, Field, Icon, Logo, Tag } from "../atoms";
import { Modal } from "../molecules";
import { PhoneVerification } from "../molecules/PhoneVerification";
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
  onRefresh,
  onStepSave,
  prefill,
  sessionError,
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
  onRefresh?: () => void;
  onStepSave: (payload: FormData) => Promise<OnboardingFinishResult>;
  prefill?: OnboardingPrefill;
  sessionError?: string;
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
    documentRequirementsLoading,
    documentRequirementsError,
    isLastStep,
    lockedDocumentStage,
    pending,
    phoneVerificationPending,
    progress,
    requirementUploadPending,
    steps,
    submitDocumentsForReview,
    submitError,
    submitSignup,
    uploadPending,
  } = controller;
  const waitingForSignatory = activeRole === "institution" && controller.form.institutionType === "MAT_SCHOOL" && controller.signatoryApproval?.status !== "APPROVED";
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
    if (phoneVerificationPending) return;
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

  if (controller.statusStage) {
    return (
      <MatApplicationWaitingPage
        controller={controller}
        onLanding={onLanding}
        onLogout={onLogin}
      />
    );
  }

  return (
    <div className="onboarding-shell min-h-screen bg-chalk">
      <header className="onboarding-header flex flex-wrap items-center justify-between gap-3 border-b border-border bg-white px-4 py-4 sm:px-6 lg:px-8">
        <Logo size={21} onClick={onLanding} />
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted sm:inline">{headerPrompt}</span>
          <Btn variant="secondary" size="sm" onClick={onLogin}>{headerActionLabel}</Btn>
        </div>
      </header>

      <main className="onboarding-layout">
        <aside className="onboarding-rail">
          <div className="onboarding-rail-inner">
            <div>
              <div className="eyebrow mb-5 text-brand">Join SupplyED</div>
              <h1 className="font-heading">
                {roleSelected ? signupHeroTitle(activeRole) : "Choose your SupplyED path."}
              </h1>
              <p className="onboarding-rail-description">
                {roleSelected
                  ? signupHeroCopy(activeRole)
                  : "Your email is verified. Now choose whether you are hiring talent, joining as a teacher, or setting up a school workspace."}
              </p>
            </div>

            {foundingType ? (
              <div className="mt-6 rounded-lg border border-border bg-white p-4">
                <div className="font-semibold text-muted">
                  Founding {foundingType === "teacher" ? "teacher" : "school"} interest received
                </div>
                <p className="mt-1 text-sm leading-6 text-muted">
                  We have carried across the details you already shared.
                </p>
              </div>
            ) : null}

            <div className="onboarding-steps">
              {(lockedDocumentStage ? [] : steps).map((item, index) => {
                const itemStep = index + 1;
                const active = !lockedDocumentStage && itemStep === currentStep;
                const complete = lockedDocumentStage || itemStep < currentStep;

                return (
                  <button
                    key={item.label}
                    aria-current={active ? "step" : undefined}
                    disabled={Boolean(pending) || phoneVerificationPending}
                    className="onboarding-step"
                    data-active={active}
                    data-complete={complete}
                    onClick={() => {
                      if (!lockedDocumentStage && itemStep < currentStep) setStep(itemStep);
                    }}
                    type="button"
                  >
                    <span
                      className="onboarding-step-number"
                    >
                      {complete ? <Icon name="check" size={14} /> : itemStep}
                    </span>
                    <span>
                      <span className="onboarding-step-label">{item.label}</span>
                      <span className="onboarding-step-description">{item.description}</span>
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
                    <span className="onboarding-step-label">Required documents</span>
                    <span className="onboarding-step-description">Upload documents and send for review</span>
                  </span>
                </div>
              ) : null}
            </div>

            <div className="onboarding-path-note">
              <div className="text-xs uppercase tracking-[1px] text-muted">Current path</div>
              <div className="mt-1 font-heading">{lockedDocumentStage ? "Document review" : roleSelected ? roleLabel(activeRole) : "Role selection"}</div>
              <p className="text-muted">
                {lockedDocumentStage ? "Profile details are locked. Upload the required documents to continue." : "You can change this in the account step before submitting."}
              </p>
            </div>
          </div>
        </aside>

        <section className="onboarding-canvas">
          <div className="onboarding-canvas-heading">
            <div>
              <Tag>{lockedDocumentStage ? "Required documents" : `Step ${currentStep} of ${steps.length}`}</Tag>
              <h2 className="mt-3 font-heading">
                {pageTitle}
              </h2>
              <p className="mt-2 max-w-[760px] text-muted">{pageDescription}</p>
            </div>
            <div className="onboarding-progress-summary">
              <div className="mb-2 flex justify-between text-xs font-semibold uppercase tracking-[1px] text-muted">
                <span>Progress</span>
                <span>{displayProgress}%</span>
              </div>
              <div className="progress" role="progressbar" aria-label="Profile setup progress" aria-valuenow={displayProgress} aria-valuemin={0} aria-valuemax={100}>
                <div className="progress-fill" style={{ width: `${displayProgress}%` }} />
              </div>
            </div>
          </div>

          <div className="flex-1">
            {lockedDocumentStage ? (
              <div className="space-y-6">
                <PhoneVerificationCard controller={controller} />
                <div className={controller.form.institutionType === "MAT_SCHOOL" ? "grid items-start gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" : "space-y-6"}>
                  {controller.form.institutionType === "MAT_SCHOOL" ? (
                    <SignatoryApprovalCard controller={controller} onRefresh={onRefresh} />
                  ) : null}
                  <DocumentUploadStep controller={controller} />
                </div>
              </div>
            ) : (
              <OnboardingStepContent
                accountEmail={accountEmail}
                controller={controller}
                roleSelected={roleSelected}
                setRole={setRole}
              />
            )}
          </div>

          {sessionError || submitError ? (
            <div className="mt-6 rounded-xl border border-danger bg-danger-tint px-4 py-3 text-sm font-semibold text-danger">
              {sessionError || submitError}
            </div>
          ) : null}

          <div className="onboarding-actions mt-8 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            {lockedDocumentStage ? (
              <span className="text-sm font-semibold text-muted">Profile created. Previous onboarding steps are locked.</span>
            ) : (
              <Btn variant="ghost" disabled={currentStep === 1 || Boolean(pending) || phoneVerificationPending} onClick={() => setStep(Math.max(1, currentStep - 1))}>Back</Btn>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span className="self-center text-xs font-semibold uppercase tracking-[1px] text-muted">
                {lockedDocumentStage ? (waitingForSignatory ? "Documents and trust approval are checked separately" : "Documents required before review") : "Saved on continue"}
              </span>
              <Btn
                loading={pending === "step" || pending === "submit"}
                loadingLabel={lockedDocumentStage ? "Sending for review" : isLastStep ? "Creating profile" : "Saving step"}
                size="lg"
                iconRight="arrow"
                disabled={Boolean(phoneVerificationPending || uploadPending || requirementUploadPending || (lockedDocumentStage && (documentRequirementsLoading || documentRequirementsError)))}
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
              <div className="font-heading text-2xl leading-tight">Create this profile?</div>
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

function PhoneVerificationCard({ controller }: { controller: OnboardingFormController }) {
  return (
    <div className="rounded-xl border border-brand-tint-2 bg-brand-tint p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-semibold text-brand-dark">Verify your phone</div>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-dark/75">
            Your profile has been created. Confirm the phone number saved on your profile before sending it for review.
          </p>
        </div>
        <PhoneVerification
          disabled={Boolean(controller.pending)}
          hidePhoneInput
          onChange={(phone) => controller.updateField("phone", phone)}
          phone={controller.form.phone || controller.savedPhone}
          savedPhone={controller.savedPhone}
          verified={controller.phoneVerified}
        />
      </div>
    </div>
  );
}

function MatApplicationWaitingPage({
  controller,
  onLanding,
  onLogout,
}: {
  controller: OnboardingFormController;
  onLanding: () => void;
  onLogout: () => void;
}) {
  const approval = controller.signatoryApproval;
  const trustApproved = approval?.status === "APPROVED";
  const signatoryLabel = approval?.status ? approval.status.toLowerCase().replace("_", " ") : "not requested";

  return (
    <div className="account-status-shell min-h-screen bg-chalk">
      <header className="flex min-h-[76px] items-center justify-between border-b border-border bg-white px-4 py-3 sm:px-6 lg:px-12">
        <Logo size={20} onClick={onLanding} />
        <div className="flex items-center gap-2">
          <Btn variant="secondary" onClick={onLanding}>View Home</Btn>
          <Btn variant="ghost" onClick={onLogout}>Logout</Btn>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-76px)] max-w-[1040px] items-center px-4 py-10 sm:px-6 lg:px-8">
        <section className="account-status-card w-full border border-border bg-white">
          <Tag tone={trustApproved ? "green" : "amber"}>Profile status pending</Tag>
          <h1 className="mt-4 font-heading">Your school is not ready for workspace access yet.</h1>
          <p className="mt-4 max-w-[760px] text-base leading-7 text-muted">
            Your documents are ready. SupplyED will submit the school for application review as soon as the trust signatory approval is confirmed. The workspace stays locked until both checks are complete and the school profile is active.
          </p>

          <div className="mt-7 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-chalk p-5">
              <div className="label-xs">Application review</div>
              <div className="mt-2 font-heading text-xl">{trustApproved ? "Ready to submit" : "Waiting for trust approval"}</div>
              <p className="mt-2 text-sm leading-6 text-muted">
                {trustApproved ? "Check the application now to submit it to SupplyED for review." : "The backend cannot accept the review submission until the trust has approved the school."}
              </p>
              <Btn className="mt-4" icon="clock" loading={controller.pending === "submit"} loadingLabel="Checking application" onClick={() => void controller.submitDocumentsForReview()}>
                Check application
              </Btn>
            </div>

            <div className="rounded-xl border border-border bg-chalk p-5">
              <div className="label-xs">Trust signatory approval</div>
              <div className="mt-2 font-heading text-xl capitalize">{signatoryLabel}</div>
              <p className="mt-2 text-sm leading-6 text-muted">
                {trustApproved
                  ? "The trust has approved this school. Check the application to continue."
                  : approval?.status === "DECLINED"
                    ? approval.declineReason || "The signatory declined this request. Return to update and resend it."
                    : approval?.status === "EXPIRED" || approval?.status === "REVOKED"
                      ? "This request is no longer valid. Return to the document screen to send a new request."
                      : `Waiting for ${approval?.signatoryName || "the trust signatory"} to respond.`}
              </p>
              <Btn className="mt-4" variant="secondary" loading={controller.pending === "status"} loadingLabel="Checking approval" onClick={() => void controller.refreshSignatoryApproval()}>
                Check signatory approval
              </Btn>
            </div>
          </div>

          {controller.submitError ? (
            <div className="mt-6 rounded-xl border border-danger bg-danger-tint px-4 py-3 text-sm font-semibold text-danger" role="alert">
              {controller.submitError}
            </div>
          ) : null}

          <div className="mt-7 flex flex-wrap gap-3">
            <Btn variant="secondary" onClick={controller.returnToDocuments}>Review documents and signatory</Btn>
            <Btn variant="ghost" onClick={onLogout}>Logout</Btn>
          </div>
        </section>
      </main>
    </div>
  );
}

function SignatoryApprovalCard({
  controller,
  onRefresh,
}: {
  controller: OnboardingFormController;
  onRefresh?: () => void;
}) {
  const approval = controller.signatoryApproval;
  const status = approval?.status;
  const canResend = status !== "APPROVED";
  const title = status === "APPROVED"
    ? "Approved by your trust"
    : status === "DECLINED"
      ? "Trust approval was declined"
      : status === "EXPIRED"
        ? "Trust approval link expired"
        : status === "REVOKED"
          ? "Trust approval is no longer valid"
          : "Waiting for trust signatory approval";
  const message = status === "APPROVED"
    ? approval?.approvedByAdmin
      ? "SupplyED recorded this approval after verifying it with the trust."
      : "The trust signatory approved this school. Complete any required documents, then submit for review."
    : status === "DECLINED"
      ? approval?.declineReason || "Update the signatory details and send a new request."
      : status === "EXPIRED"
        ? "The signatory did not respond before the link expired. Update the details and send a new request."
        : status === "REVOKED"
          ? "The trust details or approval request changed. Send a new request."
          : `An approval email was sent${approval?.signatoryName ? ` to ${approval.signatoryName}` : " to your trust signatory"}.`;

  return (
    <div className={`rounded-xl border p-5 ${status === "APPROVED" ? "border-success bg-success-tint" : status === "DECLINED" ? "border-danger bg-danger-tint" : "border-brand-tint-2 bg-brand-tint"}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-semibold">{title}</div>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">{message}</p>
          {approval?.expiresAt && status === "PENDING" ? (
            <p className="mt-2 text-xs text-muted">Link expires {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(approval.expiresAt))}.</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          {canResend ? <Btn size="sm" loading={controller.pending === "submit"} onClick={() => void controller.requestSignatoryApproval()}>{status === "PENDING" ? "Resend approval request" : "Send approval request"}</Btn> : null}
          {onRefresh ? <Btn size="sm" variant="secondary" onClick={onRefresh}>Refresh status</Btn> : null}
        </div>
      </div>
      {canResend ? (
        <div className="mt-5 grid gap-x-4 sm:grid-cols-2">
          <Field label="Signatory name" error={controller.errors.signatoryName} required>
            <input className="input" maxLength={200} value={controller.form.signatoryName} onChange={(event) => controller.updateField("signatoryName", event.target.value)} />
          </Field>
          <Field label="Signatory email" error={controller.errors.signatoryEmail} required>
            <input className="input" maxLength={254} type="email" value={controller.form.signatoryEmail} onChange={(event) => controller.updateField("signatoryEmail", event.target.value)} />
          </Field>
          <Field label="Signatory job title" error={controller.errors.signatoryJobTitle} required>
            <input className="input" maxLength={150} value={controller.form.signatoryJobTitle} onChange={(event) => controller.updateField("signatoryJobTitle", event.target.value)} />
          </Field>
        </div>
      ) : null}
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
