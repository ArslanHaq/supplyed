"use client";

import { useMemo, useState } from "react";
import { City, Country, type ICity } from "country-state-city";

import { usePhoneVerificationPending } from "@/features/auth/use-phone-verification";
import { useSettingsProfile, useUpdateSettings, useUploadSettingsProfileImage } from "@/features/settings/use-settings";
import type {
  SettingsInstitutionUpdateInput,
  SettingsInstructorUpdateInput,
  SettingsProfileSnapshot,
  SettingsUpdateInput,
  SettingsUserUpdateInput,
} from "@/features/settings/types";
import type { AppRole, ApplicationStatus, RouteProps } from "@/types/supplyed";

import { Avatar, Btn, Checkbox, Field, Icon, Tag } from "../atoms";
import { PageHead, PostcodeLookup, SectionLoader } from "../molecules";
import { NotificationSettings } from "./NotificationSettings";
import { PayoutSettings } from "./PayoutSettings";
import { PhoneVerification } from "../molecules/PhoneVerification";

type SettingsForm = {
  institution: SettingsInstitutionUpdateInput;
  instructor: SettingsInstructorUpdateInput;
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

function arrayToText(values: string[]) {
  return values.join(", ");
}

function textToArray(value: string) {
  return Array.from(new Set(value.split(",").map((item) => item.trim()).filter(Boolean)));
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

function displayName(snapshot: SettingsProfileSnapshot) {
  if (snapshot.role === "institution") return snapshot.institution?.name || snapshot.user.name;
  if (snapshot.role === "teacher") return snapshot.instructor?.fullName || snapshot.user.name;

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
    user: {
      name: snapshot?.user.name ?? "",
      phone: snapshot?.user.phone ?? "",
    },
  };
}

function profileExists(snapshot: SettingsProfileSnapshot, role: AppRole) {
  if (role === "teacher") return Boolean(snapshot.instructor?.id);
  if (role === "institution") return Boolean(snapshot.institution?.id);
  return false;
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
        <select className="select" disabled={!countryCode} onChange={(event) => onCityChange(event.target.value)} value={city}>
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

export function SettingsPage({ go, state, toast, verified }: Pick<RouteProps, "go" | "state" | "toast"> & { verified: boolean }) {
  const profileQuery = useSettingsProfile();
  const phoneVerificationPending = usePhoneVerificationPending();
  const profile = profileQuery.data;
  const snapshotKey = JSON.stringify(profile ? {
    ...profile,
    institution: profile.institution ? { ...profile.institution, imageUrl: undefined } : undefined,
    instructor: profile.instructor ? { ...profile.instructor, imageUrl: undefined } : undefined,
    user: { ...profile.user, phone: undefined, phoneVerified: undefined, updatedAt: undefined },
  } : null);
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

  function setProfileImageUrl(imageUrl: string | null) {
    const value = imageUrl ?? "";

    setForm((current) => {
      if (role === "teacher") return { ...current, instructor: { ...current.instructor, imageUrl: value } };
      if (role === "institution") return { ...current, institution: { ...current.institution, imageUrl: value } };

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
    if (phoneVerificationPending) return;

    if (!profile || !role) {
      setSubmitError("Profile settings are not ready yet.");
      return;
    }

    const payload: SettingsUpdateInput = {
      institution: role === "institution" ? form.institution : undefined,
      instructor: role === "teacher" ? form.instructor : undefined,

      role,
      // Phone changes are committed only by successful SMS verification.
      user: { ...form.user, phone: profile.user.phone },
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

      <div className="max-w-[1120px]">
        <section className="card card-pad-lg">
          <div className="mb-6 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <Avatar name={displayName(profile)} size="lg" src={profileImageUrl} />
              <div className="min-w-0">
                <div className="section-title mb-1">My profile</div>
                <div className="truncate font-heading text-2xl leading-tight text-ink sm:text-3xl">{displayName(profile)}</div>
                <p className="mt-1 text-sm leading-6 text-muted">{profile.user.email}</p>
              </div>
            </div>
            <Btn icon="shield" onClick={() => go("security")} variant="secondary">
              Manage security
            </Btn>
          </div>

          <div className="grid-2">
            <ProfileImageField
              disabled={!canSave}
              error={profileImageError}
              imageUrl={profileImageUrl}
              name={displayName(profile)}
              onFile={uploadProfileImageFile}
              pending={uploadProfileImage.isPending}
            />
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
            <div className="sm:col-span-2">
              <PhoneVerification
                disabled={updateSettings.isPending}
                error={errors.phone}
                onChange={(phone) => updateUser("phone", phone)}
                phone={form.user.phone}
                savedPhone={profile.user.phone}
                verified={profile.user.phoneVerified}
              />
              <p className="mb-4 text-xs text-muted">Phone changes take effect after you confirm the SMS code.</p>
            </div>

            {role === "teacher" ? (
              <>
                <Field error={errors.fullName} label="Full name" required>
                  <input
                    className="input"
                    onChange={(event) => updateInstructor("fullName", event.target.value)}
                    value={form.instructor.fullName}
                  />
                </Field>
                <PostcodeLookup
                  id="settings-instructor-postcode"
                  label="Postal code"
                  onChange={(value) => updateInstructor("postalCode", value)}
                  onSelect={(selection) => {
                    updateInstructorCountry("GB");
                    updateInstructor("postalCode", selection.postcode);
                    if (selection.city) updateInstructor("city", selection.city);
                    if (selection.county) updateInstructor("county", selection.county);
                  }}
                  value={form.instructor.postalCode}
                />
                <Field label="Address">
                  <input
                    className="input"
                    onChange={(event) => updateInstructor("address", event.target.value)}
                    value={form.instructor.address}
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
                <Field label="Currency">
                  <input
                    className="input"
                    onChange={(event) => updateInstructor("currency", event.target.value)}
                    value={form.instructor.currency}
                  />
                </Field>
                <Field label="Experience">
                  <input
                    className="input"
                    min={0}
                    onChange={(event) => updateInstructor("experience", event.target.value)}
                    type="number"
                    value={form.instructor.experience}
                  />
                </Field>
                <Field label="Max travel distance">
                  <input
                    className="input"
                    min={0}
                    onChange={(event) => updateInstructor("maxTravelDistance", event.target.value)}
                    type="number"
                    value={form.instructor.maxTravelDistance}
                  />
                </Field>
                <Field label="Hourly rate">
                  <input
                    className="input"
                    min={0}
                    onChange={(event) => updateInstructor("hourlyRate", event.target.value)}
                    type="number"
                    value={form.instructor.hourlyRate}
                  />
                </Field>
                <Field label="Daily rate">
                  <input
                    className="input"
                    min={0}
                    onChange={(event) => updateInstructor("dailyRate", event.target.value)}
                    type="number"
                    value={form.instructor.dailyRate}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Bio">
                    <textarea
                      className="textarea"
                      onChange={(event) => updateInstructor("bio", event.target.value)}
                      value={form.instructor.bio}
                    />
                  </Field>
                </div>
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
                <div className="sm:col-span-2">
                  <ArrayField
                    label="Skills"
                    onChange={(value) => updateInstructor("skills", value)}
                    placeholder="Classroom management, SEN"
                    value={form.instructor.skills}
                  />
                </div>
              </>
            ) : null}

            {role === "institution" ? (
              <>
                <Field error={errors.schoolName} label="School or organisation" required>
                  <input
                    className="input"
                    onChange={(event) => updateInstitution("name", event.target.value)}
                    value={form.institution.name}
                  />
                </Field>
                <Field label="Registration ID">
                  <input
                    className="input"
                    onChange={(event) => updateInstitution("registrationId", event.target.value)}
                    value={form.institution.registrationId}
                  />
                </Field>
                <Field error={errors.domain} label="Domain" required>
                  <input
                    className="input"
                    onChange={(event) => updateInstitution("domain", event.target.value)}
                    value={form.institution.domain}
                  />
                </Field>
                <PostcodeLookup
                  id="settings-institution-postcode"
                  label="Postal code"
                  onChange={(value) => updateInstitution("postalCode", value)}
                  onSelect={(selection) => {
                    updateInstitutionCountry("GB");
                    updateInstitution("postalCode", selection.postcode);
                    if (selection.city) updateInstitution("city", selection.city);
                    if (selection.county) updateInstitution("county", selection.county);
                  }}
                  value={form.institution.postalCode}
                />
                <Field error={errors.address} label="Address" required>
                  <input
                    className="input"
                    onChange={(event) => updateInstitution("address", event.target.value)}
                    value={form.institution.address}
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
                <Field label="Your role">
                  <input
                    className="input"
                    onChange={(event) => updateInstitution("userRole", event.target.value)}
                    value={form.institution.userRole}
                  />
                </Field>
                <Field label="Typical pupil count">
                  <input
                    className="input"
                    min={0}
                    onChange={(event) => updateInstitution("typicalPupilCount", event.target.value)}
                    type="number"
                    value={form.institution.typicalPupilCount}
                  />
                </Field>
                <Field label="Compliance contact">
                  <input
                    className="input"
                    onChange={(event) => updateInstitution("complianceContact", event.target.value)}
                    value={form.institution.complianceContact}
                  />
                </Field>
                <Field error={errors.complianceEmail} label="Compliance email">
                  <input
                    className="input"
                    onChange={(event) => updateInstitution("complianceEmail", event.target.value)}
                    value={form.institution.complianceEmail}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Staffing needs">
                    <textarea
                      className="textarea"
                      onChange={(event) => updateInstitution("staffingNeeds", event.target.value)}
                      value={form.institution.staffingNeeds}
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <ArrayField
                    label="Cover types"
                    onChange={(value) => updateInstitution("coverTypes", value)}
                    placeholder="Same-day cover, Long-term roles"
                    value={form.institution.coverTypes}
                  />
                </div>
                <div className="sm:col-span-2 rounded-lg border border-border bg-chalk px-4 py-3">
                  <Checkbox
                    checked={form.institution.safeguardingConfirmed}
                    label="Safeguarding responsibility confirmed"
                    onChange={(value) => updateInstitution("safeguardingConfirmed", value)}
                  />
                </div>
              </>
            ) : null}
          </div>
        </section>

        {role === "teacher" && profile.instructor?.id ? <div className="mt-6"><PayoutSettings /></div> : null}
        {role === "teacher" || role === "institution" ? <div className="mt-6"><NotificationSettings role={role} toast={toast} /></div> : null}

        {submitError ? (
          <div className="mt-5 rounded-xl border border-danger bg-danger-tint px-4 py-3 text-sm font-semibold text-danger">
            {submitError}
          </div>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Btn onClick={() => go("dashboard")} variant="ghost">
            Cancel
          </Btn>
          <Btn disabled={!canSave || phoneVerificationPending} iconRight="check" loading={updateSettings.isPending} loadingLabel="Saving" size="lg" type="submit">
            Save settings
          </Btn>
        </div>
      </div>
    </form>
  );
}
