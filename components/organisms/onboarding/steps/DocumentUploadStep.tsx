import { filterProfileDocumentRequirements } from "@/features/onboarding/document-requirements";

import { Btn, Icon } from "../../../atoms";
import { acceptAttribute, describeAllowedMimes, formatByteLimit, isDocumentReadyForReview } from "@/features/onboarding/document-utils";
import type { StepComponentProps } from "../step-types";
import { UploadCard } from "../UploadCard";
import { toUploadedFileFromDocument } from "../utils";

export function DocumentUploadStep({ controller }: StepComponentProps) {
  const {
    activeRole,
    pending,
    documentRequirements,
    documentRequirementsLoading,
    documentRequirementsError,
    retryDocumentRequirements,
    requirementDocumentErrors,
    requirementDocuments,
    requirementUploadPending,
    requirementViewPending,
    uploadRequirementDocument,
    viewRequirementDocument,
  } = controller;
  const profileDocuments = filterProfileDocumentRequirements(documentRequirements, activeRole);

  if (documentRequirementsError) return (
    <div role="alert" className="space-y-4">
      <p className="text-danger">Document requirements could not be checked. Please try again.</p>
      <Btn variant="secondary" onClick={retryDocumentRequirements}>Retry</Btn>
    </div>
  );
  if (documentRequirementsLoading) return <p role="status" className="text-muted">Checking document requirements...</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand-tint-2 bg-brand-tint p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand">
            <Icon name="file" size={20} />
          </div>
          <div>
            <div className="font-semibold text-brand-dark">Profile created</div>
            <p className="mt-1 text-sm leading-6 text-brand-dark/80">
              Upload any required documents below, then continue to your dashboard. You can replace documents that need changes here.
            </p>
          </div>
        </div>
      </div>

      {profileDocuments.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {profileDocuments.map((requirement) => {
            const document = requirementDocuments[requirement.id];
            const file = document ? toUploadedFileFromDocument(document) : null;

            return (
              <UploadCard
                key={requirement.id}
                id={`required-document-${requirement.id}`}
                title={requirement.documentType.name}
                description={requirement.isRequired ? "Upload this document before continuing to your dashboard." : "You can add this document if it applies to you."}
                icon="file"
                accept={acceptAttribute(requirement.documentType.allowedMimes)}
                meta={`${describeAllowedMimes(requirement.documentType.allowedMimes)} - Up to ${formatByteLimit(requirement.documentType.maxSizeBytes)}`}
                required={requirement.isRequired}
                disabled={Boolean(pending || requirementUploadPending)}
                file={file}
                error={requirementDocumentErrors[requirement.id] || (document?.uploadedAt && !isDocumentReadyForReview(document) ? "This document needs to be uploaded again before you can resubmit." : undefined)}
                pending={requirementUploadPending === requirement.id}
                rejectionComment={document?.rejectionComment}
                status={document?.status}
                viewPending={requirementViewPending === requirement.id}
                actionLabel="Upload document"
                onFile={(file) => uploadRequirementDocument(requirement.id, file)}
                onView={() => viewRequirementDocument(requirement.id, file)}
              />
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-white p-5 text-sm text-muted">
          No additional documents are required for this profile.
        </div>
      )}
    </div>
  );
}
