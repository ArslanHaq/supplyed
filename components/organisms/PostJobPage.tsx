import { useState } from "react";

import type { RouteProps } from "@/types/supplyed";

import { Btn, Checkbox, Field, Tag } from "../atoms";
import { SelectDropdown } from "../molecules/OptionDropdowns";
import { PageHead } from "../molecules";

type PostingMode = "instant" | "brief";

export function PostJobPage({ go, toast }: Pick<RouteProps, "go" | "toast">) {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<PostingMode>("instant");
  const [form, setForm] = useState({ title: "", keyStage: "KS2", subject: "Maths", startDate: "Tomorrow, Wed 25 Mar", duration: "1 day", rate: 180, urgent: false, dbsRequired: true, qtsRequired: false, minExperience: "1+ year" });
  const publish = () => {
    toast({ title: "Job posted", msg: "AI matching started - 6 candidates notified." });
    go("applications", { jobId: "j-101" });
  };

  return (
    <div className="app-page">
      <PageHead title="Post a new role" subtitle="Most posts take under 60 seconds. Urgent posts are instantly matched to available teachers." />
      <div className="mb-7 flex flex-wrap gap-2.5">
        {["Type", "Details", "Requirements", "Review"].map((label, index) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`step ${index + 1 < step ? "done" : index + 1 === step ? "active" : ""}`}>{index + 1}</div>
            <span className={index + 1 === step ? "font-semibold" : "text-muted"}>{label}</span>
            {index < 3 ? <div className={`step-bar ${index + 1 < step ? "done" : ""}`} /> : null}
          </div>
        ))}
      </div>
      <div className="card card-pad-lg max-w-[920px]">
        {step === 1 ? (
          <div>
            <div className="eyebrow mb-2.5">Step 1 - Posting type</div>
            <h2 className="mb-5 font-serif text-[26px]">How do you want to staff this role?</h2>
            <div className="grid-2">
              {[
                { value: "instant" as const, title: "Instant matching", desc: "Best for urgent or same-day cover.", color: "var(--se)", bg: "var(--se-tint)" },
                { value: "brief" as const, title: "Open brief", desc: "Best for long-term and competitive proposals.", color: "var(--purple)", bg: "var(--purple-tint)" },
              ].map((option) => (
                <button key={option.value} className="cursor-pointer rounded-xl border p-5 text-left" onClick={() => setMode(option.value)} style={{ borderColor: mode === option.value ? option.color : "var(--border)", borderWidth: 1.5, background: mode === option.value ? option.bg : "#fff" }} type="button">
                  <div className="mb-2 font-serif text-xl">{option.title}</div>
                  <div className="text-muted">{option.desc}</div>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {step === 2 ? (
          <div>
            <Field label="Job title"><input className="input" placeholder="e.g. Y6 Maths Cover - 1 day" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
            <div className="grid-2">
              <Field label="Key stage"><select className="select" value={form.keyStage} onChange={(event) => setForm({ ...form, keyStage: event.target.value })}><option>KS1</option><option>KS2</option><option>KS3</option><option>KS4</option><option>KS5</option></select></Field>
              <Field label="Subject"><select className="select" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })}><option>Maths</option><option>English</option><option>Science</option><option>All Primary</option></select></Field>
              <Field label="Start date"><input className="input" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></Field>
              <Field label="Day rate (£)"><input className="input" type="number" value={form.rate} onChange={(event) => setForm({ ...form, rate: Number(event.target.value) })} /></Field>
            </div>
            <Field label="Description"><textarea className="textarea" defaultValue="Covering Y6 Maths for the day. Lesson plans will be provided on arrival. Class of 28 pupils, well-behaved. Parking available on-site." /></Field>
            <Checkbox checked={form.urgent} onChange={(value) => setForm({ ...form, urgent: value })} label="Mark as urgent" />
          </div>
        ) : null}
        {step === 3 ? (
          <div>
            <Field label="Required qualifications">
              <div className="flex flex-col gap-2">
                <Checkbox checked={form.dbsRequired} onChange={(value) => setForm({ ...form, dbsRequired: value })} label="Enhanced DBS Certificate" />
                <Checkbox checked={form.qtsRequired} onChange={(value) => setForm({ ...form, qtsRequired: value })} label="QTS qualified" />
                <Checkbox checked={false} onChange={() => {}} label="SEN experience" />
              </div>
            </Field>
            <Field label="Minimum experience">
              <SelectDropdown
                options={["Any", "ECT welcome", "1+ year", "3+ years", "5+ years"]}
                value={form.minExperience}
                onChange={(value) => setForm({ ...form, minExperience: value })}
              />
            </Field>
          </div>
        ) : null}
        {step === 4 ? (
          <div>
            <div className="eyebrow mb-2.5">Step 4 - Review</div>
            <div className="card card-pad bg-chalk">
              <div className="mb-2.5 flex flex-wrap gap-2"><Tag tone={mode === "instant" ? "" : "purple"}>{mode === "instant" ? "Instant matching" : "Open brief"}</Tag>{form.urgent ? <Tag tone="red">Urgent</Tag> : null}</div>
              <div className="font-serif text-[22px]">{form.title || "Y6 Maths Cover - 1 day"}</div>
              <div className="mt-2.5 flex flex-wrap gap-2"><span className="pill">{form.keyStage}</span><span className="pill">{form.subject}</span><span className="pill">{form.minExperience}</span><span className="pill">£{form.rate}/day</span>{form.dbsRequired ? <span className="pill">DBS required</span> : null}</div>
            </div>
          </div>
        ) : null}
        <div className="mt-8 flex items-center justify-between">
          <Btn variant="ghost" onClick={() => (step > 1 ? setStep(step - 1) : go("dashboard"))}>{step > 1 ? "Back" : "Cancel"}</Btn>
          <Btn size="lg" iconRight={step === 4 ? "send" : "arrow"} onClick={() => (step < 4 ? setStep(step + 1) : publish())}>{step < 4 ? "Continue" : "Publish job"}</Btn>
        </div>
      </div>
    </div>
  );
}
