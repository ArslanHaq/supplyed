"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import { describeDegree } from "@/features/degree-checks/presentation";
import { CONSENT_FORM_TYPES, MAX_CONSENT_FORM_BYTES, type DegreeIdentity } from "@/features/degree-checks/types";
import { useDegreeInstitutions, useMyDegreeCheck, useSubmitDegreeCheck } from "@/features/degree-checks/use-degree-checks";
import { shortDate } from "@/features/identity-verification/presentation";

import { Btn, buttonClassName, Field, Icon, Tag } from "../atoms";
import { SelectDropdown } from "../molecules";

const STATE_TAGS = {
  IN_PROGRESS: { label: "With the university", tone: "amber" },
  VERIFIED: { label: "Verified", tone: "green" },
  NOT_VERIFIED: { label: "Not verified", tone: "red" },
} as const;

/**
 * The teacher's optional degree check through Hedd, in Settings. Hidden while
 * degree checks are switched off (or can't be loaded): nothing depends on it.
 */
export function DegreeSettings() {
  const query = useMyDegreeCheck();
  const mine = query.data;

  if (!mine?.available) return null;

  const check = mine.degreeCheck;
  const tag = check ? STATE_TAGS[check.state] : null;

  return (
    <section aria-labelledby="degree-settings-heading" className="card card-pad-lg mt-6" id="degree-settings">
      <div className="account-section-icon"><Icon name="award" size={20} /></div>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-heading text-2xl leading-tight" id="degree-settings-heading">Degree verification</h2>
        {tag ? <Tag tone={tag.tone}>{tag.label}</Tag> : <Tag tone="ghost">Optional</Tag>}
      </div>
      <p className="mt-2 max-w-[660px] text-sm leading-6 text-muted">
        Optional. We check your degree with your university through Hedd, and schools see a &ldquo;Degree verified&rdquo; badge on your profile.
      </p>

      {check?.state === "IN_PROGRESS" ? (
        <p className="mt-4 text-sm leading-6 text-ink">
          {describeDegree(check)} is with the university{check.dueDate ? `, expected by ${shortDate(check.dueDate)}` : ""}.
        </p>
      ) : null}
      {check?.state === "VERIFIED" ? (
        <p className="mt-4 text-sm font-semibold leading-6 text-success">Verified: {describeDegree(check.degree ?? check)}</p>
      ) : null}
      {check?.state === "NOT_VERIFIED" ? (
        <p className="mt-4 text-sm leading-6 text-ink">
          {describeDegree(check)} could not be verified{check.notes ? `: ${check.notes}` : "."}
          {mine.canStart ? " You can start a new check below." : null}
        </p>
      ) : null}

      {mine.canStart ? (
        <DegreeCheckForm identity={mine.identity} />
      ) : !check ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted">Verify your identity first: we send your verified name and date of birth to the university.</p>
          <Link className={buttonClassName({ size: "sm", variant: "secondary" })} href="/verify-identity">Verify identity</Link>
        </div>
      ) : null}
    </section>
  );
}

function DegreeCheckForm({ identity }: { identity: DegreeIdentity | null }) {
  const institutionsQuery = useDegreeInstitutions(true);
  const submit = useSubmitDegreeCheck();
  const [form, setForm] = useState({
    classification: "",
    courseName: "",
    dateOfBirth: "",
    firstNames: "",
    institutionId: "",
    lastName: "",
    lastNameAtStudy: identity?.birthSurname ?? "",
    qualificationType: "",
    yearOfAward: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>();
  const set = (field: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [field]: value }));

  const institutions = institutionsQuery.data?.institutions ?? [];
  const selected = institutions.find((institution) => String(institution.id) === form.institutionId);
  const consentFormUrl = selected?.consentFormUrl ?? institutionsQuery.data?.standardConsentFormUrl;
  const year = Number(form.yearOfAward);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !CONSENT_FORM_TYPES.includes(file.type) || file.size > MAX_CONSENT_FORM_BYTES) {
      setFileError("Upload the signed consent form as a PDF, JPEG, PNG or TIFF of up to 5 MB.");
      return;
    }

    submit.mutate({
      file,
      input: {
        classification: form.classification.trim(),
        courseName: form.courseName.trim(),
        institutionId: Number(form.institutionId),
        lastNameAtStudy: form.lastNameAtStudy.trim() || undefined,
        qualificationType: form.qualificationType.trim(),
        yearOfAward: year,
        ...(identity ? {} : { dateOfBirth: form.dateOfBirth, firstNames: form.firstNames.trim(), lastName: form.lastName.trim() }),
      },
    });
  }

  return (
    <form className="mt-5" onSubmit={onSubmit}>
      {identity ? (
        <p className="mb-5 text-sm text-muted">
          We send your verified name and date of birth: <span className="font-semibold text-ink">{identity.firstNames} {identity.lastName}, {shortDate(identity.dateOfBirth)}</span>
        </p>
      ) : (
        <div className="grid gap-x-4 sm:grid-cols-3">
          <Field label="First names (testing)" required><input className="input" maxLength={120} required value={form.firstNames} onChange={(event) => set("firstNames")(event.target.value)} /></Field>
          <Field label="Surname (testing)" required><input className="input" maxLength={60} required value={form.lastName} onChange={(event) => set("lastName")(event.target.value)} /></Field>
          <Field label="Date of birth (testing)" required><input className="input" required type="date" value={form.dateOfBirth} onChange={(event) => set("dateOfBirth")(event.target.value)} /></Field>
        </div>
      )}

      <Field label="University" required error={institutionsQuery.isError ? "The list of universities could not be loaded. Refresh to try again." : undefined}>
        <SelectDropdown
          disabled={!institutionsQuery.data}
          onChange={set("institutionId")}
          options={institutions.map((institution) => ({ label: institution.name, value: String(institution.id) }))}
          placeholder={institutionsQuery.isLoading ? "Loading universities..." : "Choose your university"}
          required
          searchable
          value={form.institutionId}
        />
      </Field>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Course name" hint="The course you enrolled on, e.g. Mathematics" required>
          <input className="input" maxLength={120} required value={form.courseName} onChange={(event) => set("courseName")(event.target.value)} />
        </Field>
        <Field label="Qualification type" hint="As on your certificate, e.g. BSc Hons" required>
          <input className="input" maxLength={60} required value={form.qualificationType} onChange={(event) => set("qualificationType")(event.target.value)} />
        </Field>
        <Field label="Classification" hint="e.g. 2:1. Enter Pass if your certificate gives none" required>
          <input className="input" maxLength={60} required value={form.classification} onChange={(event) => set("classification")(event.target.value)} />
        </Field>
        <Field label="Year of award" required>
          <input className="input" inputMode="numeric" max={new Date().getFullYear()} min={1940} required type="number" value={form.yearOfAward} onChange={(event) => set("yearOfAward")(event.target.value)} />
        </Field>
      </div>
      <Field label="Surname at the time of study" hint="Only if it was different from your surname now">
        <input className="input" maxLength={60} value={form.lastNameAtStudy} onChange={(event) => set("lastNameAtStudy")(event.target.value)} />
      </Field>
      <Field label="Signed consent form" hint="PDF, JPEG, PNG or TIFF, up to 5 MB. It lets your university share your degree details with us." error={fileError} required>
        <input
          accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff"
          className="input"
          onChange={(event) => { setFile(event.target.files?.[0] ?? null); setFileError(undefined); }}
          required
          type="file"
        />
      </Field>
      {consentFormUrl ? (
        <p className="-mt-3 mb-5 text-xs text-muted">
          <a className="font-semibold text-brand underline" href={consentFormUrl} rel="noreferrer" target="_blank">
            {selected?.consentFormUrl ? `Download ${selected.name}'s consent form` : "Download Hedd's consent form"}
          </a>
          , sign it, then upload it here.
        </p>
      ) : null}

      {submit.error ? <div className="mb-4 text-sm font-semibold text-danger" role="alert">{submit.error.message}</div> : null}
      <Btn disabled={!form.institutionId || !Number.isInteger(year)} loading={submit.isPending} loadingLabel="Sending..." type="submit">
        Check my degree
      </Btn>
    </form>
  );
}
