import { filterProfileDocumentRequirements } from "@/features/onboarding/document-requirements";

import { Icon } from "../../../atoms";
import type { StepComponentProps } from "../step-types";
import { UploadCard } from "../UploadCard";
import { toUploadedFileFromDocument } from "../utils";

function acceptForMimes(mimes: string[]) {
  const values = mimes
    .map((mime) => {
      if (mime === "application/pdf") return ".pdf";
      if (mime === "image/jpeg") return ".jpg,.jpeg";
      if (mime === "image/png") return ".png";
      return mime;
    })
    .filter(Boolean);

  return values.length > 0 ? values.join(",") : ".pdf,.png,.jpg,.jpeg";
}

export function DocumentUploadStep({ controller }: StepComponentProps) {
  const {
    activeRole,
    documentRequirements,
    requirementDocumentErrors,
    requirementDocuments,
    requirementUploadPending,
    requirementViewPending,
    uploadRequirementDocument,
    viewRequirementDocument,
  } = controller;
  const requiredDocuments = filterProfileDocumentRequirements(documentRequirements, activeRole).filter(
    (requirement) => requirement.isRequired,
  );

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
              Upload the required document{requiredDocuments.length === 1 ? "" : "s"} below. This stage is locked so the profile can move cleanly into review.
            </p>
          </div>
        </div>
      </div>

      {requiredDocuments.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {requiredDocuments.map((requirement) => {
            const document = requirementDocuments[requirement.id];
            const file = document ? toUploadedFileFromDocument(document) : null;

            return (
              <UploadCard
                key={requirement.id}
                id={`required-document-${requirement.id}`}
                title={requirement.documentType.name}
                description="Upload this required profile document before sending the profile for review."
                icon="file"
                accept={acceptForMimes(requirement.documentType.allowedMimes)}
                file={file}
                error={requirementDocumentErrors[requirement.id]}
                pending={requirementUploadPending === requirement.id}
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