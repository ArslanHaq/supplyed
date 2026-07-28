import { Field, Icon } from "../../../atoms";
import { UploadCard } from "../UploadCard";
import type { StepComponentProps } from "../step-types";
import { fieldClass } from "../utils";

export function TeacherDocumentsStep({ controller }: StepComponentProps) {
  const {
    errors,
    form,
    updateField,
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
              Upload PDF, JPG, or PNG files only. Each file must be 10 MB or smaller.
            </p>
          </div>
        </div>
      </div>

      <Field label="Enhanced DBS certificate number" htmlFor="dbs-number" error={errors.dbsNumber} required>
        <input
          id="dbs-number"
          className={fieldClass(errors.dbsNumber)}
          value={form.dbsNumber}
          onChange={(event) => updateField("dbsNumber", event.target.value)}
          placeholder="Certificate number"
        />
      </Field>

      <div className="grid gap-4 xl:grid-cols-2">
        <UploadCard
          id="dbs-certificate-file"
          title="DBS Certificate"
          description="Upload the certificate file that matches the DBS number above."
          icon="file"
          accept=".pdf,.png,.jpg,.jpeg"
          file={form.dbsCertificateFile}
          error={errors.dbsCertificateFile}
          pending={uploadPending === "dbsCertificateFile"}
          viewPending={viewPending === "dbsCertificateFile"}
          actionLabel="Upload certificate"
          onFile={(file) => uploadDocument("dbsCertificateFile", file)}
          onView={() => viewDocument("dbsCertificateFile", form.dbsCertificateFile)}
        />
        <UploadCard
          id="identity-photo"
          title="Photo ID (Passport / Driving Licence)"
          description="Upload a clear passport, driving licence, or official photo ID."
          icon="image"
          accept=".pdf,.png,.jpg,.jpeg"
          capture="environment"
          file={form.identityPhoto}
          error={errors.identityPhoto}
          pending={uploadPending === "identityPhoto"}
          viewPending={viewPending === "identityPhoto"}
          actionLabel="Upload ID"
          onFile={(file) => uploadDocument("identityPhoto", file)}
          onView={() => viewDocument("identityPhoto", form.identityPhoto)}
        />
        <UploadCard
          id="qualification-file"
          title="Teaching Qualifications / QTS"
          description="Upload a certificate or QTS evidence document."
          icon="file"
          accept=".pdf,.png,.jpg,.jpeg"
          file={form.qualificationFile}
          error={errors.qualificationFile}
          pending={uploadPending === "qualificationFile"}
          viewPending={viewPending === "qualificationFile"}
          actionLabel="Upload qualification"
          onFile={(file) => uploadDocument("qualificationFile", file)}
          onView={() => viewDocument("qualificationFile", form.qualificationFile)}
        />
        <UploadCard
          id="right-to-work-file"
          title="Proof of Address"
          description="Upload a recent bill, bank statement, or official address evidence."
          icon="file"
          accept=".pdf,.png,.jpg,.jpeg"
          file={form.rightToWorkFile}
          error={errors.rightToWorkFile}
          pending={uploadPending === "rightToWorkFile"}
          viewPending={viewPending === "rightToWorkFile"}
          actionLabel="Upload evidence"
          onFile={(file) => uploadDocument("rightToWorkFile", file)}
          onView={() => viewDocument("rightToWorkFile", form.rightToWorkFile)}
        />
      </div>
    </div>
  );
}
