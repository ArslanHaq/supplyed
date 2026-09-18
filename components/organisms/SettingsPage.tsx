"use client";

import { useMemo, useState } from "react";
import { City, Country, type ICity } from "country-state-city";

import { useSettingsProfile, useUpdateSettings, useUploadSettingsProfileImage } from "@/features/settings/use-settings";
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
import { ApplicationDocuments } from "./ApplicationDocuments";

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

const profileImageAccept = "image/jpeg,image/png,image/webp";
const profileImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxProfileImageBytes = 5 * 1024 * 1024;

function profileImageContentType(file: File) {
  const explicitType = file.type.toLowerCase();
  if (profileImageTypes.has(explicitType)) return explicitType;

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";

  return explicitType;
}

function profileImageValidationError(file: File) {
  if (file.size > maxProfileImageBytes) return "Profile image must be 5 MB or smaller.";
  if (!profileImageTypes.has(profileImageContentType(file))) return "Profile image must be a JPG, PNG, or WebP file.";
  return undefined;
}

function profileImageUrlForRole(form: SettingsForm, role: AppRole | null | undefined) {
  if (role === "teacher") return form.instructor.imageUrl;
  if (role === "institution") return form.institution.imageUrl;
  if (role === "individual") return form.recruiter.imageUrl;
  return "";
}
const countryOptions = Country.getAllCountries().sort((first, second) => first.name.localeCompare(second.name));

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
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function uniqueCities(cities: ICity[]) {
  const seen = new Set<string>();

  return cities
    .filter((city) => {
      const key = city.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((first, second) => first.name.localeCompare(second.name));
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
  if (status === "deactivated") return "Deactivated";
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

function ProfileImageField({
  disabled,
  error,
  imageUrl,
  name,
  onFile,
  pending,
}: {
  disabled?: boolean;
  error?: string;
  imageUrl: string;
  name: string;
  onFile: (file: File) => void;
  pending?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-chalk p-4 sm:col-span-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={name} size="lg" src={imageUrl} />
          <div className="min-w-0">
            <div className="font-semibold text-ink">Profile image</div>
            <p className="mt-1 text-sm leading-6 text-muted">JPG, PNG, or WebP up to 5 MB.</p>
            {error ? <p className="mt-1 text-xs font-semibold text-danger">{error}</p> : null}
          </div>
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full border border-border-strong bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-brand hover:bg-brand-tint focus-within:outline-none focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2">
          <Icon className={pending ? "animate-spin" : undefined} name={pending ? "loader" : "upload"} size={15} />
          {pending ? "Uploading" : imageUrl ? "Replace image" : "Upload image"}
          <input
            accept={profileImageAccept}
            className="sr-only"
            disabled={disabled || pending}
            onChange={(event) => {
              const selectedFile = event.target.files?.[0];
              if (!selectedFile) return;
              onFile(selectedFile);
              event.target.value = "";
            }}
            type="file"
          />
        </label>
      </div>
    </div>
  );
}
function CountryCityFields({
  city,
  cityError,
  cityRequired,
  countryCode,
  countryError,
  countryRequired,
  onCityChange,
  onCountryChange,
}: {
  city: string;
  cityError?: string;
  cityRequired?: boolean;
  countryCode: string;
  countryError?: string;
  countryRequired?: boolean;
  onCityChange: (value: string) => void;
  onCountryChange: (value: string) => void;
}) {
  const cityOptions = useMemo(() => uniqueCities(City.getCitiesOfCountry(countryCode) ?? []), [countryCode]);
  const currentCityInOptions = cityOptions.some((option) => option.name === city);

  return (
    <>
      <Field error={countryError} label="Country" required={countryRequired}>
        <select className="select" onChange={(event) => onCountryChange(event.target.value)} value={countryCode}>
          <option value="">Select country</option>
          {countryOptions.map((country) => (
            <option key={country.isoCode} value={country.isoCode}>
              {country.name}
            </option>
          ))}
        </select>
      </Field>
      <Field error={cityError} label="City" required={cityRequired}>
        <select
          className="select"
          disabled={!countryCode}
          onChange={(event) => onCityChange(event.target.value)}
          value={city}
        >
          <option value="">{countryCode ? "Select city" : "Select country first"}</option>
          {city && !currentCityInOptions ? <option value={city}>{city}</option> : null}
          {cityOptions.map((cityOption) => (
            <option key={cityOption.name} value={cityOption.name}>
              {cityOption.name}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}

export function SettingsPage({
  go,
  state,
  toast,
  verified,
}: Pick<RouteProps, "go" | "state" | "toast"> & { verified: boolean }) {
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
  const [profileImageError, setProfileImageError] = useState<string>();
  const profileImageUrl = profileImageUrlForRole(form, role);

  const uploadProfileImage = useUploadSettingsProfileImage({
    onError: () => {
      setProfileImageError("Profile image could not be uploaded. Choose another image and try again.");
      toast({ title: "Could not upload image", msg: "Choose another image and try again.", tone: "danger" });
    },
    onSuccess: async (result) => {
      if (!result.ok) {
        setProfileImageError(result.message);
        toast({ title: "Could not upload image", msg: result.message, tone: "danger" });
        return;
      }

      setProfileImageUrl(result.data.imageUrl);
      setProfileImageError(undefined);
      toast({ title: "Profile image updated", msg: "Your profile image was uploaded.", tone: "success" });
    },
  });
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

  function updateUser<Field extends keyof SettingsUserUpdateInput>(
    field: Field,
    value: SettingsUserUpdateInput[Field],
  ) {
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

  function updateInstructorCountry(countryCode: string) {
    setForm((current) => ({ ...current, instructor: { ...current.instructor, city: "", countryCode } }));
    setErrors((current) => ({ ...current, city: undefined, countryCode: undefined }));
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

  function updateInstitutionCountry(countryCode: string) {
    setForm((current) => ({ ...current, institution: { ...current.institution, city: "", countryCode } }));
    setErrors((current) => ({ ...current, city: undefined, countryCode: undefined }));
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

  function updateRecruiterCountry(countryCode: string) {
    setForm((current) => ({ ...current, recruiter: { ...current.recruiter, city: "", countryCode } }));
    setErrors((current) => ({ ...current, city: undefined, countryCode: undefined }));
    setSubmitError(undefined);
  }

  function setProfileImageUrl(imageUrl: string | null) {
    const value = imageUrl ?? "";

    setForm((current) => {
      if (role === "teacher") return { ...current, instructor: { ...current.instructor, imageUrl: value } };
      if (role === "institution") return { ...current, institution: { ...current.institution, imageUrl: value } };
      if (role === "individual") return { ...current, recruiter: { ...current.recruiter, imageUrl: value } };
      return current;
    });
  }

  function uploadProfileImageFile(file: File) {
    const validationError = profileImageValidationError(file);

    if (validationError) {
      setProfileImageError(validationError);
      toast({ title: "Could not upload image", msg: validationError, tone: "danger" });
      return;
    }

    setProfileImageError(undefined);
    uploadProfileImage.mutate(file);
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
            {verified ? <Tag tone="green">Verified</Tag> : null}
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
                  <input
                    className="input"
                    value={form.instructor.fullName}
                    onChange={(event) => updateInstructor("fullName", event.target.value)}
                  />
                </Field>
                <ProfileImageField
                  disabled={!canSave}
                  error={profileImageError}
                  imageUrl={form.instructor.imageUrl}
                  name={form.instructor.fullName || displayName(profile)}
                  onFile={uploadProfileImageFile}
                  pending={uploadProfileImage.isPending}
                />{" "}
                <Field label="Address">
                  <input
                    className="input"
                    value={form.instructor.address}
                    onChange={(event) => updateInstructor("address", event.target.value)}
                  />
                </Field>
                <CountryCityFields
                  city={form.instructor.city}
                  cityError={errors.city}
                  countryCode={form.instructor.countryCode}
                  countryError={errors.countryCode}
                  onCityChange={(value) => updateInstructor("city", value)}
                  onCountryChange={updateInstructorCountry}
                />
                <Field label="Postal code">
                  <input
                    className="input"
                    value={form.instructor.postalCode}
                    onChange={(event) => updateInstructor("postalCode", event.target.value)}
                  />
                </Field>
                <Field label="Currency">
                  <input
                    className="input"
                    value={form.instructor.currency}
                    onChange={(event) => updateInstructor("currency", event.target.value)}
                  />
                </Field>
                <Field label="Experience">
                  <input
                    className="input"
                    min={0}
                    type="number"
                    value={form.instructor.experience}
                    onChange={(event) => updateInstructor("experience", event.target.value)}
                  />
                </Field>
                <Field label="Max travel distance">
                  <input
                    className="input"
                    min={0}
                    type="number"
                    value={form.instructor.maxTravelDistance}
                    onChange={(event) => updateInstructor("maxTravelDistance", event.target.value)}
                  />
                </Field>
                <Field label="Hourly rate">
                  <input
                    className="input"
                    min={0}
                    type="number"
                    value={form.instructor.hourlyRate}
                    onChange={(event) => updateInstructor("hourlyRate", event.target.value)}
                  />
                </Field>
                <Field label="Daily rate">
                  <input
                    className="input"
                    min={0}
                    type="number"
                    value={form.instructor.dailyRate}
                    onChange={(event) => updateInstructor("dailyRate", event.target.value)}
                  />
                </Field>
              </div>

              <Field label="Bio">
                <textarea
                  className="textarea"
                  value={form.instructor.bio}
                  onChange={(event) => updateInstructor("bio", event.target.value)}
                />
              </Field>
              <div className="grid-2">
                <ArrayField
                  label="Subjects"
                  onChange={(value) => updateInstructor("subjects", value)}
                  placeholder="Mathematics, Physics"
                  value={form.instructor.subjects}
                />
                <ArrayField
                  label="Key stages"
                  onChange={(value) => updateInstructor("keyStages", value)}
                  placeholder="KS2, KS3"
                  value={form.instructor.keyStages}
                />
                <ArrayField
                  label="Skills"
                  onChange={(value) => updateInstructor("skills", value)}
                  placeholder="Classroom management, SEN"
                  value={form.instructor.skills}
                />
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
                  <p className="text-sm leading-6 text-muted">
                    Organisation, staffing, and safeguarding profile details.
                  </p>
                </div>
              </div>

              <div className="grid-2">
                <Field error={errors.schoolName} label="School or organisation" required>
                  <input
                    className="input"
                    value={form.institution.name}
                    onChange={(event) => updateInstitution("name", event.target.value)}
                  />
                </Field>
                <ProfileImageField
                  disabled={!canSave}
                  error={profileImageError}
                  imageUrl={form.institution.imageUrl}
                  name={form.institution.name || displayName(profile)}
                  onFile={uploadProfileImageFile}
                  pending={uploadProfileImage.isPending}
                />{" "}
                <Field label="Registration ID">
                  <input
                    className="input"
                    value={form.institution.registrationId}
                    onChange={(event) => updateInstitution("registrationId", event.target.value)}
                  />
                </Field>
                <Field error={errors.domain} label="Domain" required>
                  <input
                    className="input"
                    value={form.institution.domain}
                    onChange={(event) => updateInstitution("domain", event.target.value)}
                  />
                </Field>
                <Field error={errors.address} label="Address" required>
                  <input
                    className="input"
                    value={form.institution.address}
                    onChange={(event) => updateInstitution("address", event.target.value)}
                  />
                </Field>
                <CountryCityFields
                  city={form.institution.city}
                  cityError={errors.city}
                  cityRequired
                  countryCode={form.institution.countryCode}
                  countryError={errors.countryCode}
                  countryRequired
                  onCityChange={(value) => updateInstitution("city", value)}
                  onCountryChange={updateInstitutionCountry}
                />
                <Field label="Postal code">
                  <input
                    className="input"
                    value={form.institution.postalCode}
                    onChange={(event) => updateInstitution("postalCode", event.target.value)}
                  />
                </Field>
                <Field label="Your role">
                  <input
                    className="input"
                    value={form.institution.userRole}
                    onChange={(event) => updateInstitution("userRole", event.target.value)}
                  />
                </Field>
                <Field label="Typical pupil count">
                  <input
                    className="input"
                    min={0}
                    type="number"
                    value={form.institution.typicalPupilCount}
                    onChange={(event) => updateInstitution("typicalPupilCount", event.target.value)}
                  />
                </Field>
                <Field label="Compliance contact">
                  <input
                    className="input"
                    value={form.institution.complianceContact}
                    onChange={(event) => updateInstitution("complianceContact", event.target.value)}
                  />
                </Field>
                <Field error={errors.complianceEmail} label="Compliance email">
                  <input
                    className="input"
                    value={form.institution.complianceEmail}
                    onChange={(event) => updateInstitution("complianceEmail", event.target.value)}
                  />
                </Field>
              </div>

              <Field label="Staffing needs">
                <textarea
                  className="textarea"
                  value={form.institution.staffingNeeds}
                  onChange={(event) => updateInstitution("staffingNeeds", event.target.value)}
                />
              </Field>
              <ArrayField
                label="Cover types"
                onChange={(value) => updateInstitution("coverTypes", value)}
                placeholder="Same-day cover, Long-term roles"
                value={form.institution.coverTypes}
              />
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
                  <input
                    className="input"
                    value={form.recruiter.displayName}
                    onChange={(event) => updateRecruiter("displayName", event.target.value)}
                  />
                </Field>
                <ProfileImageField
                  disabled={!canSave}
                  error={profileImageError}
                  imageUrl={form.recruiter.imageUrl}
                  name={form.recruiter.displayName || displayName(profile)}
                  onFile={uploadProfileImageFile}
                  pending={uploadProfileImage.isPending}
                />{" "}
                <Field label="Address">
                  <input
                    className="input"
                    value={form.recruiter.address}
                    onChange={(event) => updateRecruiter("address", event.target.value)}
                  />
                </Field>
                <CountryCityFields
                  city={form.recruiter.city}
                  cityError={errors.city}
                  countryCode={form.recruiter.countryCode}
                  countryError={errors.countryCode}
                  onCityChange={(value) => updateRecruiter("city", value)}
                  onCountryChange={updateRecruiterCountry}
                />
                <Field label="Postal code">
                  <input
                    className="input"
                    value={form.recruiter.postalCode}
                    onChange={(event) => updateRecruiter("postalCode", event.target.value)}
                  />
                </Field>
              </div>

              <Field label="Bio">
                <textarea
                  className="textarea"
                  value={form.recruiter.bio}
                  onChange={(event) => updateRecruiter("bio", event.target.value)}
                />
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
            <Btn
              disabled={!canSave}
              iconRight="check"
              loading={updateSettings.isPending}
              loadingLabel="Saving"
              size="lg"
              type="submit"
            >
              Save settings
            </Btn>
          </div>
        </div>

        <aside className="flex flex-col gap-5">
          <div className="card card-pad">
            <ApplicationDocuments />
          </div>
          <section className="card card-pad-lg">
            <div className="flex items-start gap-3">
              <Avatar name={displayName(profile)} src={profileImageUrl} />
              <div className="min-w-0">
                <div className="truncate font-serif text-2xl leading-tight">{displayName(profile)}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Tag tone="ghost">{roleLabel(role)}</Tag>
                  <Tag tone={statusTone(profile.applicationStatus)}>{statusLabel(profile.applicationStatus)}</Tag>
                  {verified ? <Tag tone="green">Verified</Tag> : null}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <ReadOnlyLine label="Email status" value={profile.user.emailVerified ? "Verified" : "Not verified"} />
              <ReadOnlyLine label="Phone status" value={profile.user.phoneVerified ? "Verified" : "Not verified"} />
              {!profile.user.phoneVerified ? (
                <p className="text-xs text-muted">
                  Contact SupplyED support to verify your phone number. Changing it requires verification again.
                </p>
              ) : null}
              <ReadOnlyLine label="Two-factor" value={profile.user.twoFactorEnabled ? "Enabled" : "Disabled"} />
              <ReadOnlyLine label="Last login" value={formatDate(profile.user.lastLogin)} />
              <ReadOnlyLine label="Updated" value={formatDate(profile.user.updatedAt)} />
            </div>

            <Btn className="mt-5 w-full" icon="shield" onClick={() => go("security")} variant="secondary">
              Manage two-factor
            </Btn>
          </section>

          <section className="card card-pad-lg">
            <div className="section-title mb-4">Profile record</div>
            <div className="grid gap-3">
              {role === "teacher" ? (
                <>
                  <ReadOnlyLine label="DBS verified" value={profile.instructor?.dbsVerified ? "Yes" : "No"} />
                  <ReadOnlyLine
                    label="Rating"
                    value={
                      profile.instructor?.ratingAverage
                        ? `${profile.instructor.ratingAverage} from ${profile.instructor.ratingCount} reviews`
                        : "No rating"
                    }
                  />
                </>
              ) : null}

              {role === "institution" ? (
                <>
                  <ReadOnlyLine label="Verified" value={profile.institution?.verified ? "Yes" : "No"} />
                  <ReadOnlyLine label="Created" value={formatDate(profile.institution?.createdAt ?? null)} />
                </>
              ) : null}

              {role === "individual" ? (
                <>
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
