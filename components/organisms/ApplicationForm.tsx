import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSettingsProfile, useUpdateSettings } from "@/features/settings/use-settings";
import type { SettingsInstructorUpdateInput, SettingsProfileSnapshot } from "@/features/settings/types";
import { Avatar, Btn, Field } from "../atoms";
import { SectionLoader, TagInput } from "../molecules";

type Props = {
  jobTitle: string;
  pending: boolean;
  canApply: boolean;
  onCancel: () => void;
  onBusyChange: (busy: boolean) => void;
  onSubmit: (coverLetter: string) => void;
};

export function ApplicationForm(props: Props) {
  const profileQuery = useSettingsProfile();
  if (profileQuery.isLoading) return <SectionLoader rows={4} />;
  if (!profileQuery.data?.instructor)
    return (
      <div role="alert">
        <p>Your instructor profile could not be loaded.</p>
        <Btn onClick={() => void profileQuery.refetch()}>Try again</Btn>
      </div>
    );
  return <ApplicationFormFields {...props} snapshot={profileQuery.data} key={profileQuery.data.instructor.id} />;
}

function ApplicationFormFields({
  snapshot,
  jobTitle,
  pending,
  canApply,
  onCancel,
  onSubmit,
  onBusyChange,
}: Props & { snapshot: SettingsProfileSnapshot }) {
  const [profile, setProfile] = useState<SettingsInstructorUpdateInput>(snapshot.instructor!);
  const [coverLetter, setCoverLetter] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const saveProfile = useUpdateSettings();
  const queryClient = useQueryClient();
  const busy = pending || submitting;
  const update = <K extends keyof SettingsInstructorUpdateInput>(key: K, value: SettingsInstructorUpdateInput[K]) =>
    setProfile((current) => ({ ...current, [key]: value }));
  const numbers = [
    ["maxTravelDistance", "Maximum travel distance (miles)", "any"],
    ["experience", "Teaching experience (years)", "1"],
    ["hourlyRate", "Hourly rate", "0.01"],
    ["dailyRate", "Daily rate", "0.01"],
  ] as const;
  const location = [
    ["address", "Address", 250],
    ["city", "City", 100],
    ["county", "County", 100],
    ["postalCode", "Postcode", 20],
  ] as const;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canApply || busy) return;
    setError("");
    setSubmitting(true);
    onBusyChange(true);
    try {
      if (JSON.stringify(profile) !== JSON.stringify(snapshot.instructor)) {
        const result = await saveProfile.mutateAsync({
          role: "teacher",
          instructor: profile,
          user: { name: snapshot.user.name, phone: snapshot.user.phone },
        });
        if (!result.ok) {
          setError(result.message || "Your profile could not be saved. Please check the fields.");
          return;
        }
        await queryClient.invalidateQueries({ queryKey: ["matching"] });
        await queryClient.invalidateQueries({ queryKey: ["instructor-profile"] });
      }
      onSubmit(coverLetter.trim());
    } catch {
      setError("Your profile could not be saved. Please try again before submitting your application.");
    } finally {
      setSubmitting(false);
      onBusyChange(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <h2 className="font-serif text-2xl">Apply for {jobTitle}</h2>
      <p className="my-4 text-sm text-muted">
        Your account details are prefilled. Add any missing information below. Changes are saved to your instructor
        profile and shared with your application.
      </p>
      <fieldset disabled={busy} className="space-y-5">
        <section className="rounded-xl border border-border p-4">
          <h3 className="section-title">Your instructor profile</h3>
          <div className="mb-4 text-sm text-muted">
            {snapshot.user.email}
            {snapshot.user.phone ? ` · ${snapshot.user.phone}` : ""}
          </div>
          <Field label="Full name" required htmlFor="application-full-name">
            <input
              id="application-full-name"
              className="input"
              required
              value={profile.fullName}
              onChange={(event) => update("fullName", event.target.value)}
            />
          </Field>
          <Field label="About you" htmlFor="application-bio">
            <textarea
              id="application-bio"
              className="textarea"
              value={profile.bio}
              onChange={(event) => update("bio", event.target.value)}
            />
          </Field>
          <div className="mb-5 flex items-center gap-3">
            <Avatar name={snapshot.instructor!.fullName} src={snapshot.instructor!.imageUrl} size="lg" />
            <div>
              <p className="text-sm font-medium">Profile photo</p>
              <p className="text-xs text-muted">Your saved account photo is used for this application.</p>
            </div>
          </div>
          <div className="grid-2">
            {(["subjects", "keyStages", "skills"] as const).map((key) => (
              <Field
                key={key}
                label={key === "keyStages" ? "Key stages" : key === "skills" ? "Skills" : "Subjects"}
                htmlFor={`application-${key}`}
              >
                <TagInput id={`application-${key}`} value={profile[key]} onChange={(value) => update(key, value)} />
              </Field>
            ))}
          </div>
        </section>
        <section className="rounded-xl border border-border p-4">
          <h3 className="section-title">Experience, rates and travel</h3>
          <div className="grid-2">
            {numbers.map(([key, label, step]) => (
              <Field
                key={key}
                label={label}
                htmlFor={`application-${key}`}
                hint={
                  key === "maxTravelDistance"
                    ? "Used to match jobs within the distance you are willing to travel."
                    : undefined
                }
              >
                <input
                  id={`application-${key}`}
                  className="input"
                  type="number"
                  min={0}
                  step={step}
                  value={profile[key]}
                  onChange={(event) => update(key, event.target.value)}
                />
              </Field>
            ))}
            <Field label="Rate currency" htmlFor="application-currency">
              <input
                id="application-currency"
                className="input"
                maxLength={3}
                minLength={3}
                pattern="[A-Za-z]{3}"
                placeholder="GBP"
                value={profile.currency}
                onChange={(event) => update("currency", event.target.value.toUpperCase())}
              />
            </Field>
          </div>
        </section>
        <section className="rounded-xl border border-border p-4">
          <h3 className="section-title">Your location</h3>
          <p className="mb-4 text-sm text-muted">Your postcode is used to calculate the distance to this job.</p>
          <div className="grid-2">
            {location.map(([key, label, maxLength]) => (
              <Field key={key} label={label} htmlFor={`application-${key}`}>
                <input
                  id={`application-${key}`}
                  className="input"
                  maxLength={maxLength}
                  value={profile[key]}
                  onChange={(event) => update(key, event.target.value)}
                />
              </Field>
            ))}
            <Field label="Country code" htmlFor="application-country">
              <input
                id="application-country"
                className="input"
                maxLength={2}
                minLength={2}
                pattern="[A-Za-z]{2}"
                placeholder="GB"
                value={profile.countryCode}
                onChange={(event) => update("countryCode", event.target.value.toUpperCase())}
              />
            </Field>
          </div>
        </section>
        <Field label="Cover letter (optional)" htmlFor="application-cover-letter">
          <textarea
            id="application-cover-letter"
            className="textarea"
            maxLength={2000}
            value={coverLetter}
            onChange={(event) => setCoverLetter(event.target.value)}
          />
        </Field>
        <p className="text-right text-xs text-muted">{coverLetter.length} / 2,000</p>
        <p className="text-sm text-muted">Supporting documents can be added to this application after submission.</p>
      </fieldset>
      {error ? (
        <p className="my-4 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex justify-between">
        <Btn type="button" variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Btn>
        <Btn type="submit" loading={busy} disabled={!canApply || busy}>
          Submit application
        </Btn>
      </div>
    </form>
  );
}
