"use client";

import { useState } from "react";

import { useSettingsProfile, useUpdateSettings } from "@/features/settings/use-settings";
import type {
  SettingsInstitutionUpdateInput,
  SettingsInstructorUpdateInput,
  SettingsProfileSnapshot,
  SettingsRecruiterUpdateInput,
  SettingsUpdateInput,
  SettingsUserUpdateInput,
} from "@/features/settings/types";
import type { AppRole, ApplicationStatus, RouteProps } from "@/types/supplyed";

import { Avatar, Btn, Checkbox, Field, Icon, Tag } from "../atoms";
import { PageHead, SectionLoader } from "../molecules";

type SettingsForm = {
  institution: SettingsInstitutionUpdateInput;
  instructor: SettingsInstructorUpdateInput;
  recruiter: SettingsRecruiterUpdateInput;
  user: SettingsUserUpdateInput;
};

type SettingsFormErrors = Partial<Record<string, string>>;

type SettingsFormCache = {
  form: SettingsForm;
  snapshotKey: string;
};

const emptyInstructor: SettingsInstructorUpdateInput = {
  address: "",
  bio: "",
  city: "",
  countryCode: "GB",
  county: "",
  currency: "GBP",
  dailyRate: "",
  experience: "",
  fullName: "",
  hourlyRate: "",
  id: "",
  imageUrl: "",
  keyStages: [],
  maxTravelDistance: "",
  postalCode: "",
  skills: [],
  subjects: [],
};

const emptyInstitution: SettingsInstitutionUpdateInput = {
  address: "",
  city: "",
  complianceContact: "",
  complianceEmail: "",
  countryCode: "GB",
  county: "",
  coverTypes: [],
  domain: "",
  id: "",
  imageUrl: "",
  name: "",
  postalCode: "",
  registrationId: "",
  safeguardingConfirmed: false,
  staffingNeeds: "",
  typicalPupilCount: "",
  userRole: "",
};

const emptyRecruiter: SettingsRecruiterUpdateInput = {
  address: "",
  bio: "",
  city: "",
  countryCode: "GB",
  county: "",
  displayName: "",
  id: "",
  imageUrl: "",
  postalCode: "",
};

function arrayToText(values: string[]) {
  return values.join(", ");
}

function textToArray(value: string) {
  return Array.from(new Set(value.split(",").map((item) => item.trim()).filter(Boolean)));
}

function roleLabel(role: AppRole | null | undefined) {
  if (role === "teacher") return "Teacher";
  if (role === "institution") return "Institution";
  if (role === "individual") return "Individual";
  return "Account";
}

function statusLabel(status: ApplicationStatus) {
  if (status === "approved") return "Approved";
  if (status === "pending_review") return "Pending review";
  if (status === "rejected") return "Rejected";
  if (status === "suspended") return "Suspended";
  return "Incomplete";
}

function statusTone(status: ApplicationStatus): "green" | "amber" | "red" | "ghost" {
  if (status === "approved") return "green";
  if (status === "pending_review") return "amber";
  if (status === "rejected" || status === "suspended") return "red";
  return "ghost";
}

function formatDate(value: string | null) {
  if (!value) return "Not recorded";

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "Not recorded";

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(parsed));
}

function displayName(snapshot: SettingsProfileSnapshot) {
  if (snapshot.role === "institution") return snapshot.institution?.name || snapshot.user.name;
  if (snapshot.role === "teacher") return snapshot.instructor?.fullName || snapshot.user.name;
  if (snapshot.role === "individual") return snapshot.recruiter?.displayName || snapshot.user.name;
  return snapshot.user.name || snapshot.user.email;
}

function createForm(snapshot?: SettingsProfileSnapshot): SettingsForm {
  return {
    institution: {
      ...emptyInstitution,
      ...(snapshot?.institution
        ? {
            address: snapshot.institution.address,
            city: snapshot.institution.city,
            complianceContact: snapshot.institution.complianceContact,
            complianceEmail: snapshot.institution.complianceEmail,
            countryCode: snapshot.institution.countryCode,
            county: snapshot.institution.county,
            coverTypes: snapshot.institution.coverTypes,
            domain: snapshot.institution.domain,
            id: snapshot.institution.id,
            imageUrl: snapshot.institution.imageUrl,
            name: snapshot.institution.name,
            postalCode: snapshot.institution.postalCode,
            registrationId: snapshot.institution.registrationId,
            safeguardingConfirmed: snapshot.institution.safeguardingConfirmed,
            staffingNeeds: snapshot.institution.staffingNeeds,
            typicalPupilCount: snapshot.institution.typicalPupilCount,
            userRole: snapshot.institution.userRole,
          }
        : {}),
    },
    instructor: {
      ...emptyInstructor,
      ...(snapshot?.instructor
        ? {
            address: snapshot.instructor.address,
            bio: snapshot.instructor.bio,
            city: snapshot.instructor.city,
            countryCode: snapshot.instructor.countryCode,
            county: snapshot.instructor.county,
            currency: snapshot.instructor.currency,
            dailyRate: snapshot.instructor.dailyRate,
            experience: snapshot.instructor.experience,
            fullName: snapshot.instructor.fullName,
            hourlyRate: snapshot.instructor.hourlyRate,
            id: snapshot.instructor.id,
            imageUrl: snapshot.instructor.imageUrl,
            keyStages: snapshot.instructor.keyStages,
            maxTravelDistance: snapshot.instructor.maxTravelDistance,
            postalCode: snapshot.instructor.postalCode,
            skills: snapshot.instructor.skills,
            subjects: snapshot.instructor.subjects,
          }
        : {}),
    },
    recruiter: {
      ...emptyRecruiter,
      ...(snapshot?.recruiter
        ? {
            address: snapshot.recruiter.address,
            bio: snapshot.recruiter.bio,
            city: snapshot.recruiter.city,
            countryCode: snapshot.recruiter.countryCode,
            county: snapshot.recruiter.county,
            displayName: snapshot.recruiter.displayName,
            id: snapshot.recruiter.id,
            imageUrl: snapshot.recruiter.imageUrl,
            postalCode: snapshot.recruiter.postalCode,
          }
        : {}),
    },
    user: {
      name: snapshot?.user.name ?? "",
      phone: snapshot?.user.phone ?? "",
    },
  };
}

function profileExists(snapshot: SettingsProfileSnapshot, role: AppRole) {
  if (role === "teacher") return Boolean(snapshot.instructor?.id);
  if (role === "institution") return Boolean(snapshot.institution?.id);
  return Boolean(snapshot.recruiter?.id);
}

function ReadOnlyLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-chalk px-3 py-2.5">
      <div className="text-[10px] font-bold uppercase tracking-[1px] text-muted">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

function ArrayField({
  error,
  hint,
  label,
  onChange,
  placeholder,
  value,
}: {
  error?: string;
  hint?: string;
  label: string;
  onChange: (value: string[]) => void;
  placeholder: string;
  value: string[];
}) {
  return (
    <Field error={error} hint={hint} label={label}>
      <textarea
        className="textarea min-h-[88px]"
        onChange={(event) => onChange(textToArray(event.target.value))}
        placeholder={placeholder}
        value={arrayToText(value)}
      />
    </Field>
  );
}

export function SettingsPage({ go, state, toast }: Pick<RouteProps, "go" | "state" | "toast">) {
  const profileQuery = useSettingsProfile();
  const profile = profileQuery.data;
  const snapshotKey = JSON.stringify(profile ?? null);
  const [formCache, setFormCache] = useState<SettingsFormCache>(() => ({
    form: createForm(profile),
    snapshotKey,
  }));
  const [errors, setErrors] = useState<SettingsFormErrors>({});
  const [submitError, setSubmitError] = useState<string>();
  const form = formCache.snapshotKey === snapshotKey ? formCache.form : createForm(profile);
  const role = profile?.role ?? state.role;
  const canSave = Boolean(profile && role && profileExists(profile, role));

  function setForm(updater: (current: SettingsForm) => SettingsForm) {
    setFormCache((current) => ({
      form: updater(current.snapshotKey === snapshotKey ? current.form : createForm(profile)),
      snapshotKey,
    }));
  }

  const updateSettings = useUpdateSettings({
    onError: () => {
      setSubmitError("Settings could not be saved. Check the details and try again.");
      toast({ title: "Could not save settings", msg: "Check the details and try again.", tone: "danger" });
    },
    onSuccess: async (result) => {
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setSubmitError(result.message);
        toast({ title: "Could not save settings", msg: result.message, tone: "danger" });
        return;
      }

      setErrors({});
      setSubmitError(undefined);
      toast({ title: "Settings saved", msg: "Your profile details were updated.", tone: "success" });
    },
  });

  function updateUser<Field extends keyof SettingsUserUpdateInput>(field: Field, value: SettingsUserUpdateInput[Field]) {
    setForm((current) => ({ ...current, user: { ...current.user, [field]: value } }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError(undefined);
  }

  function updateInstructor<Field extends keyof SettingsInstructorUpdateInput>(
    field: Field,
    value: SettingsInstructorUpdateInput[Field],
  ) {
    setForm((current) => ({ ...current, instructor: { ...current.instructor, [field]: value } }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError(undefined);
  }

  function updateInstitution<Field extends keyof SettingsInstitutionUpdateInput>(
    field: Field,
    value: SettingsInstitutionUpdateInput[Field],
  ) {
    setForm((current) => ({ ...current, institution: { ...current.institution, [field]: value } }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError(undefined);
  }

  function updateRecruiter<Field extends keyof SettingsRecruiterUpdateInput>(
    field: Field,
    value: SettingsRecruiterUpdateInput[Field],
  ) {
    setForm((current) => ({ ...current, recruiter: { ...current.recruiter, [field]: value } }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError(undefined);
  }

  function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile || !role) {
      setSubmitError("Profile settings are not ready yet.");
      return;
    }

    const payload: SettingsUpdateInput = {
      institution: role === "institution" ? form.institution : undefined,
      instructor: role === "teacher" ? form.instructor : undefined,
      recruiter: role === "individual" ? form.recruiter : undefined,
      role,
      user: form.user,
    };

    updateSettings.mutate(payload);
  }

  if (profileQuery.isLoading) {
    return (
      <div className="app-page">
        <PageHead title="Settings" subtitle="Loading your account profile." />
        <SectionLoader rows={4} />
      </div>
    );
  }

  if (!profile || profileQuery.isError) {
    return (
      <div className="app-page">
        <PageHead title="Settings unavailable" subtitle="Your profile settings could not be loaded." />
        <div className="card card-pad-lg max-w-[760px]">
          <p className="text-sm leading-6 text-muted">
            {profileQuery.error instanceof Error ? profileQuery.error.message : "Refresh the page and try again."}
          </p>
          <Btn className="mt-5" icon="arrow" onClick={() => void profileQuery.refetch()} variant="secondary">
            Try again
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <form className="app-page" noValidate onSubmit={saveSettings}>
      <PageHead
        title="Settings"
        subtitle={`Manage the account and ${roleLabel(role).toLowerCase()} profile details for ${profile.user.email}.`}
        actions={
          <>
            <Tag tone="ghost">{roleLabel(role)}</Tag>
            <Tag tone={statusTone(profile.applicationStatus)}>{statusLabel(profile.applicationStatus)}</Tag>
          </>
        }
      />

      <div className="two-col">
        <div className="flex flex-col gap-5">
          <section className="card card-pad-lg">
            <div className="mb-5 flex items-start gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-tint text-brand">
                <Icon name="user" size={22} />
              </span>
              <div>
                <div className="section-title mb-1">Account</div>
                <p className="text-sm leading-6 text-muted">Core identity stored on your SupplyED user account.</p>
              </div>
            </div>

            <div className="grid-2">
              <Field error={errors.name} label="Display name" required>
                <input
                  className="input"
                  onChange={(event) => updateUser("name", event.target.value)}
                  placeholder="Abdul Waheed"
                  value={form.user.name}
                />
              </Field>
              <Field label="Email">
                <input className="input bg-chalk text-muted" readOnly value={profile.user.email} />
              </Field>
              <Field error={errors.phone} label="Phone">
                <input
                  className="input"
                  inputMode="tel"
                  onChange={(event) => updateUser("phone", event.target.value)}
                  placeholder="+44 7700 000000"
                  value={form.user.phone}
                />
              </Field>
            </div>
          </section>

          {role === "teacher" ? (
            <section className="card card-pad-lg">
              <div className="mb-5 flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-tint text-brand">
                  <Icon name="award" size={22} />
                </span>
                <div>
                  <div className="section-title mb-1">Teacher profile</div>
                  <p className="text-sm leading-6 text-muted">Teaching, location, rate, and public profile details.</p>
                </div>
              </div>

              <div className="grid-2">
                <Field error={errors.fullName} label="Full name" required>
                  <input className="input" value={form.instructor.fullName} onChange={(event) => updateInstructor("fullName", event.target.value)} />
                </Field>
                <Field label="Profile image URL">
                  <input className="input" value={form.instructor.imageUrl} onChange={(event) => updateInstructor("imageUrl", event.target.value)} />
                </Field>
                <Field label="Address">
                  <input className="input" value={form.instructor.address} onChange={(event) => updateInstructor("address", event.target.value)} />
                </Field>
                <Field label="City">
                  <input className="input" value={form.instructor.city} onChange={(event) => updateInstructor("city", event.target.value)} />
                </Field>
                <Field label="County">
                  <input className="input" value={form.instructor.county} onChange={(event) => updateInstructor("county", event.target.value)} />
                </Field>
                <Field label="Postal code">
                  <input className="input" value={form.instructor.postalCode} onChange={(event) => updateInstructor("postalCode", event.target.value)} />
                </Field>
                <Field label="Country code">
                  <input className="input" value={form.instructor.countryCode} onChange={(event) => updateInstructor("countryCode", event.target.value)} />
                </Field>
                <Field label="Currency">
                  <input className="input" value={form.instructor.currency} onChange={(event) => updateInstructor("currency", event.target.value)} />
                </Field>
                <Field label="Experience">
                  <input className="input" min={0} type="number" value={form.instructor.experience} onChange={(event) => updateInstructor("experience", event.target.value)} />
                </Field>
                <Field label="Max travel distance">
                  <input className="input" min={0} type="number" value={form.instructor.maxTravelDistance} onChange={(event) => updateInstructor("maxTravelDistance", event.target.value)} />
                </Field>
                <Field label="Hourly rate">
                  <input className="input" min={0} type="number" value={form.instructor.hourlyRate} onChange={(event) => updateInstructor("hourlyRate", event.target.value)} />
                </Field>
                <Field label="Daily rate">
                  <input className="input" min={0} type="number" value={form.instructor.dailyRate} onChange={(event) => updateInstructor("dailyRate", event.target.value)} />
                </Field>
              </div>

              <Field label="Bio">
                <textarea className="textarea" value={form.instructor.bio} onChange={(event) => updateInstructor("bio", event.target.value)} />
              </Field>
              <div className="grid-2">
                <ArrayField label="Subjects" onChange={(value) => updateInstructor("subjects", value)} placeholder="Mathematics, Physics" value={form.instructor.subjects} />
                <ArrayField label="Key stages" onChange={(value) => updateInstructor("keyStages", value)} placeholder="KS2, KS3" value={form.instructor.keyStages} />
                <ArrayField label="Skills" onChange={(value) => updateInstructor("skills", value)} placeholder="Classroom management, SEN" value={form.instructor.skills} />
              </div>
            </section>
          ) : null}

          {role === "institution" ? (
            <section className="card card-pad-lg">
              <div className="mb-5 flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-tint text-brand">
                  <Icon name="building" size={22} />
                </span>
                <div>
                  <div className="section-title mb-1">Institution profile</div>
                  <p className="text-sm leading-6 text-muted">Organisation, staffing, and safeguarding profile details.</p>
                </div>
              </div>

              <div className="grid-2">
                <Field error={errors.schoolName} label="School or organisation" required>
                  <input className="input" value={form.institution.name} onChange={(event) => updateInstitution("name", event.target.value)} />
                </Field>
                <Field label="Profile image URL">
                  <input className="input" value={form.institution.imageUrl} onChange={(event) => updateInstitution("imageUrl", event.target.value)} />
                </Field>
                <Field label="Registration ID">
                  <input className="input" value={form.institution.registrationId} onChange={(event) => updateInstitution("registrationId", event.target.value)} />
                </Field>
                <Field error={errors.domain} label="Domain" required>
                  <input className="input" value={form.institution.domain} onChange={(event) => updateInstitution("domain", event.target.value)} />
                </Field>
                <Field error={errors.address} label="Address" required>
                  <input className="input" value={form.institution.address} onChange={(event) => updateInstitution("address", event.target.value)} />
                </Field>
                <Field error={errors.city} label="City" required>
                  <input className="input" value={form.institution.city} onChange={(event) => updateInstitution("city", event.target.value)} />
                </Field>
                <Field label="County">
                  <input className="input" value={form.institution.county} onChange={(event) => updateInstitution("county", event.target.value)} />
                </Field>
                <Field label="Postal code">
                  <input className="input" value={form.institution.postalCode} onChange={(event) => updateInstitution("postalCode", event.target.value)} />
                </Field>
                <Field label="Country code">
                  <input className="input" value={form.institution.countryCode} onChange={(event) => updateInstitution("countryCode", event.target.value)} />
                </Field>
                <Field label="Your role">
                  <input className="input" value={form.institution.userRole} onChange={(event) => updateInstitution("userRole", event.target.value)} />
                </Field>
                <Field label="Typical pupil count">
                  <input className="input" min={0} type="number" value={form.institution.typicalPupilCount} onChange={(event) => updateInstitution("typicalPupilCount", event.target.value)} />
                </Field>
                <Field label="Compliance contact">
                  <input className="input" value={form.institution.complianceContact} onChange={(event) => updateInstitution("complianceContact", event.target.value)} />
                </Field>
                <Field error={errors.complianceEmail} label="Compliance email">
                  <input className="input" value={form.institution.complianceEmail} onChange={(event) => updateInstitution("complianceEmail", event.target.value)} />
                </Field>
              </div>

              <Field label="Staffing needs">
                <textarea className="textarea" value={form.institution.staffingNeeds} onChange={(event) => updateInstitution("staffingNeeds", event.target.value)} />
              </Field>
              <ArrayField label="Cover types" onChange={(value) => updateInstitution("coverTypes", value)} placeholder="Same-day cover, Long-term roles" value={form.institution.coverTypes} />
              <Checkbox
                checked={form.institution.safeguardingConfirmed}
                label="Safeguarding responsibility confirmed"
                onChange={(value) => updateInstitution("safeguardingConfirmed", value)}
              />
            </section>
          ) : null}

          {role === "individual" ? (
            <section className="card card-pad-lg">
              <div className="mb-5 flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-tint text-brand">
                  <Icon name="heart" size={22} />
                </span>
                <div>
                  <div className="section-title mb-1">Individual profile</div>
                  <p className="text-sm leading-6 text-muted">Hiring profile, public name, and location details.</p>
                </div>
              </div>

              <div className="grid-2">
                <Field error={errors.displayName} label="Display name" required>
                  <input className="input" value={form.recruiter.displayName} onChange={(event) => updateRecruiter("displayName", event.target.value)} />
                </Field>
                <Field label="Profile image URL">
                  <input className="input" value={form.recruiter.imageUrl} onChange={(event) => updateRecruiter("imageUrl", event.target.value)} />
                </Field>
                <Field label="Address">
                  <input className="input" value={form.recruiter.address} onChange={(event) => updateRecruiter("address", event.target.value)} />
                </Field>
                <Field label="City">
                  <input className="input" value={form.recruiter.city} onChange={(event) => updateRecruiter("city", event.target.value)} />
                </Field>
                <Field label="County">
                  <input className="input" value={form.recruiter.county} onChange={(event) => updateRecruiter("county", event.target.value)} />
                </Field>
                <Field label="Postal code">
                  <input className="input" value={form.recruiter.postalCode} onChange={(event) => updateRecruiter("postalCode", event.target.value)} />
                </Field>
                <Field label="Country code">
                  <input className="input" value={form.recruiter.countryCode} onChange={(event) => updateRecruiter("countryCode", event.target.value)} />
                </Field>
              </div>

              <Field label="Bio">
                <textarea className="textarea" value={form.recruiter.bio} onChange={(event) => updateRecruiter("bio", event.target.value)} />
              </Field>
            </section>
          ) : null}

          {submitError ? (
            <div className="rounded-xl border border-danger bg-danger-tint px-4 py-3 text-sm font-semibold text-danger">
              {submitError}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Btn onClick={() => go("dashboard")} variant="ghost">
              Cancel
            </Btn>
            <Btn disabled={!canSave} iconRight="check" loading={updateSettings.isPending} loadingLabel="Saving" size="lg" type="submit">
              Save settings
            </Btn>
          </div>
        </div>

        <aside className="flex flex-col gap-5">
          <section className="card card-pad-lg">
            <div className="flex items-start gap-3">
              <Avatar name={displayName(profile)} />
              <div className="min-w-0">
                <div className="truncate font-serif text-2xl leading-tight">{displayName(profile)}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Tag tone="ghost">{roleLabel(role)}</Tag>
                  <Tag tone={statusTone(profile.applicationStatus)}>{statusLabel(profile.applicationStatus)}</Tag>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <ReadOnlyLine label="Email status" value={profile.user.emailVerified ? "Verified" : "Not verified"} />
              <ReadOnlyLine label="Phone status" value={profile.user.phoneVerified ? "Verified" : "Not verified"} />
              <ReadOnlyLine label="Two-factor" value={profile.user.twoFactorEnabled ? "Enabled" : "Disabled"} />
              <ReadOnlyLine label="Last login" value={formatDate(profile.user.lastLogin)} />
              <ReadOnlyLine label="Updated" value={formatDate(profile.user.updatedAt)} />
            </div>

            <Btn className="mt-5 w-full" icon="shield" onClick={() => go("security")} variant="secondary">
              Security
            </Btn>
          </section>

          <section className="card card-pad-lg">
            <div className="section-title mb-4">Profile record</div>
            <div className="grid gap-3">
              {role === "teacher" ? (
                <>
                  <ReadOnlyLine label="Profile ID" value={profile.instructor?.id ?? "Not created"} />
                  <ReadOnlyLine label="DBS verified" value={profile.instructor?.dbsVerified ? "Yes" : "No"} />
                  <ReadOnlyLine label="Rating" value={profile.instructor?.ratingAverage ? `${profile.instructor.ratingAverage} from ${profile.instructor.ratingCount} reviews` : "No rating"} />
                </>
              ) : null}

              {role === "institution" ? (
                <>
                  <ReadOnlyLine label="Profile ID" value={profile.institution?.id ?? "Not created"} />
                  <ReadOnlyLine label="Verified" value={profile.institution?.verified ? "Yes" : "No"} />
                  <ReadOnlyLine label="Created" value={formatDate(profile.institution?.createdAt ?? null)} />
                </>
              ) : null}

              {role === "individual" ? (
                <>
                  <ReadOnlyLine label="Profile ID" value={profile.recruiter?.id ?? "Not created"} />
                  <ReadOnlyLine label="Created" value={formatDate(profile.recruiter?.createdAt ?? null)} />
                  <ReadOnlyLine label="Updated" value={formatDate(profile.recruiter?.updatedAt ?? null)} />
                </>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </form>
  );
}
