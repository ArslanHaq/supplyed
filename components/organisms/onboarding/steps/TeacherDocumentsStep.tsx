import { CardGridLoader } from "@/components/molecules/Loaders";

import { Btn, Icon } from "../../../atoms";
import { UploadCard } from "../UploadCard";
import type { StepComponentProps } from "../step-types";
import { requirementAccept, requirementDescription, requirementIcon, requirementLimits } from "../utils";

export function TeacherDocumentsStep({ controller }: StepComponentProps) {
  const {
    documentErrors,
    documentRequirements,
    documentRequirementsError,
    documentRequirementsLoading,
    errors,
    form,
    retryDocumentRequirements,
    uploadDocument,
    uploadPending,
    viewDocument,
    viewPending,
  } = controller;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-brand-tint-2 bg-brand-tint p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand">
            <Icon name="shield" size={19} />
          </div>
          <div>
            <div className="font-semibold text-brand-dark">Instructor documents</div>
            <p className="mt-1 text-sm leading-6 text-brand-dark/80">
              Upload each document listed below. Accepted formats and size limits are shown on every card. Files stay private and are only used for verification.
            </p>
          </div>
        </div>
      </div>

      {errors.documents ? (
        <div className="rounded-xl border border-danger bg-danger-tint px-4 py-3 text-sm font-semibold text-danger">{errors.documents}</div>
      ) : null}

      {documentRequirementsLoading ? (
        <CardGridLoader cards={4} className="xl:grid-cols-2" />
      ) : documentRequirementsError ? (
        <div className="rounded-xl border border-danger bg-danger-tint p-5">
          <div className="font-semibold text-danger">Document requirements could not be loaded</div>
          <p className="mt-1 text-sm leading-6 text-danger/80">{documentRequirementsError}</p>
          <div className="mt-4">
            <Btn size="sm" variant="secondary" onClick={retryDocumentRequirements}>
              Retry
            </Btn>
          </div>
        </div>
      ) : documentRequirements.length === 0 ? (
        <div className="rounded-xl border border-border bg-chalk p-5">
          <div className="font-semibold">No documents are required yet</div>
          <p className="mt-1 text-sm leading-6 text-muted">
            SupplyED has not configured any document requirements for instructors. You can continue and add documents later.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {documentRequirements.map((requirement) => {
            const file = form.documents[requirement.id] ?? null;

            return (
              <UploadCard
                key={requirement.id}
                accept={requirementAccept(requirement)}
                actionLabel="Upload file"
                description={requirementDescription(requirement)}
                error={documentErrors[requirement.id]}
                file={file}
                icon={requirementIcon(requirement)}
                id={`document-${requirement.id}`}
                meta={requirementLimits(requirement)}
                onFile={(selected) => uploadDocument(requirement, selected)}
                onView={() => viewDocument(requirement.id, file)}
                pending={uploadPending === requirement.id}
                required={requirement.isRequired}
                status={file?.status}
                title={requirement.name}
                viewPending={viewPending === requirement.id}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
