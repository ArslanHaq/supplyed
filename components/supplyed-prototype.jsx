"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

const seedTeachers = [
  { id: "t-sarah", name: "Sarah Johnson", role: "KS2 & KS3 Mathematics", city: "Salford, Greater Manchester", rating: 4.9, reviews: 47, yearsExp: 5, rate: 185, dbs: true, qts: true, subjects: ["Maths", "Science"], keyStages: ["KS2", "KS3"], matchScore: 94, distance: "2.1 mi", availability: "Today" },
  { id: "t-marcus", name: "Marcus Webb", role: "KS3 & KS4 Science", city: "Bolton", rating: 4.8, reviews: 32, yearsExp: 7, rate: 195, dbs: true, qts: true, subjects: ["Biology", "Chemistry"], keyStages: ["KS3", "KS4"], matchScore: 91, distance: "6.4 mi", availability: "Today", tone: "purple" },
  { id: "t-priya", name: "Priya Mehta", role: "Primary - KS1 & KS2", city: "Manchester", rating: 4.9, reviews: 58, yearsExp: 4, rate: 175, dbs: true, qts: true, subjects: ["All Primary"], keyStages: ["KS1", "KS2"], matchScore: 88, distance: "3.8 mi", availability: "Tomorrow", tone: "amber" },
  { id: "t-tom", name: "Tom Clarke", role: "KS3 English & Drama", city: "Stockport", rating: 4.7, reviews: 21, yearsExp: 3, rate: 170, dbs: true, qts: false, subjects: ["English", "Drama"], keyStages: ["KS3", "KS4"], matchScore: 83, distance: "8.1 mi", availability: "This week", tone: "green" },
  { id: "t-amina", name: "Amina Hassan", role: "KS4 & KS5 Mathematics", city: "Manchester", rating: 5, reviews: 19, yearsExp: 9, rate: 220, dbs: true, qts: true, subjects: ["Maths", "Further Maths"], keyStages: ["KS4", "KS5"], matchScore: 79, distance: "4.2 mi", availability: "Mon 29th" },
];

const seedJobs = [
  { id: "j-101", title: "Y6 Maths Cover - 1 day", school: "Greenfield Primary", city: "Salford", date: "Tomorrow, Wed 25 Mar", rate: 180, urgent: true, keyStage: "KS2", subject: "Maths", mode: "instant", postedAt: "2h ago", applicants: 4, matchScore: 94, description: "Covering Y6 Maths for the day. Lesson plans are ready on arrival. Class of 28 pupils, well behaved, parking on site." },
  { id: "j-102", title: "KS3 English - 3 days", school: "St Helens Academy", city: "Manchester", date: "Thu 26 Mar - Sat 28 Mar", rate: 165, urgent: false, keyStage: "KS3", subject: "English", mode: "instant", postedAt: "5h ago", applicants: 7, matchScore: 88 },
  { id: "j-103", title: "Long-term Science Cover", school: "Bridgewater High", city: "Stockport", date: "From Mon 30 Mar - 4 weeks", rate: 170, urgent: false, keyStage: "KS4", subject: "Science", mode: "brief", postedAt: "1d ago", applicants: 12, matchScore: 85 },
  { id: "j-104", title: "KS1 Reception Cover", school: "Oakwood Primary", city: "Bolton", date: "Fri 27 Mar", rate: 160, urgent: false, keyStage: "KS1", subject: "All Primary", mode: "instant", postedAt: "1d ago", applicants: 3, matchScore: 76 },
];

const seedApplications = [
  { id: "a-1", teacherId: "t-sarah", jobId: "j-101", stage: "shortlisted", rate: 180, coverLetter: "Available tomorrow, happy to arrive by 08:15. Five years of Y6 Maths cover experience.", appliedAt: "1h ago" },
  { id: "a-2", teacherId: "t-marcus", jobId: "j-101", stage: "applied", rate: 195, coverLetter: "Science specialist but happy to cover Maths. Grammar-school background.", appliedAt: "2h ago" },
  { id: "a-3", teacherId: "t-priya", jobId: "j-101", stage: "interview", rate: 175, coverLetter: "KS2 specialist with strong rapport with Y6 cohorts.", appliedAt: "3h ago" },
  { id: "a-4", teacherId: "t-tom", jobId: "j-101", stage: "applied", rate: 165, coverLetter: "English and drama specialist with full-day availability this week.", appliedAt: "5h ago" },
];

const seedMessages = [
  {
    id: "m-1",
    with: "Greenfield Primary",
    lastMsg: "Yes, please sign in at reception.",
    time: "10:28",
    unread: 0,
    tone: "",
    thread: [
      { from: "them", text: "Hi Sarah, thank you for accepting the Y6 Maths role. Lesson plans will be on the teacher's desk.", time: "10:14 AM" },
      { from: "me", text: "Thank you. Should I report to reception first?", time: "10:23 AM" },
      { from: "them", text: "Yes, please sign in at reception. Parking is on the left side of the school.", time: "10:28 AM" },
    ],
  },
  {
    id: "m-2",
    with: "St Helens Academy",
    lastMsg: "Are you available Thursday onwards?",
    time: "09:12",
    unread: 2,
    tone: "purple",
    thread: [{ from: "them", text: "We've reviewed your profile. Are you available Thursday onwards for the KS3 English cover?", time: "09:12 AM" }],
  },
  { id: "m-3", with: "Bridgewater High", lastMsg: "Great - we'll send the schedule.", time: "Yesterday", unread: 0, tone: "green", thread: [{ from: "them", text: "Great - we'll send the schedule.", time: "Yesterday" }] },
];

const defaultState = {
  role: "institution",
  page: "dashboard",
  auth: "landing",
  onboardingStep: 1,
  selectedJob: "j-101",
  selectedTeacher: "t-sarah",
  selectedMessage: "m-1",
  ctx: {},
  toasts: [],
};

function Icon({ name, size = 16 }) {
  const paths = {
    home: <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1V9.5z" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
    bell: <><path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 3h16l-2-3z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
    message: <><path d="M21 12a8 8 0 1 1-3.2-6.4L21 5v6l-3 1" /><path d="M8 10h8M8 14h5" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></>,
    users: <><circle cx="9" cy="8" r="3.5" /><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6" /><circle cx="17" cy="7" r="3" /><path d="M22 18c0-2.8-2-5-5-5" /></>,
    building: <><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 7h2M9 11h2M9 15h2M13 7h2M13 11h2M13 15h2M10 21v-4h4v4" /></>,
    file: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z" /><path d="M14 3v6h6" /></>,
    check: <path d="M4 12l5 5L20 6" />,
    checkCircle: <><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></>,
    x: <path d="M6 6l12 12M18 6L6 18" />,
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
    chevronDown: <path d="M6 9l6 6 6-6" />,
    chevronRight: <path d="M9 6l6 6-6 6" />,
    shield: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" /><path d="M9 12l2.5 2.5L15 10" /></>,
    pin: <><path d="M12 22s8-7.5 8-13a8 8 0 0 0-16 0c0 5.5 8 13 8 13z" /><circle cx="12" cy="9" r="3" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
    upload: <><path d="M12 15V3M7 8l5-5 5 5" /><path d="M20 17v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" /></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M20 17v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></>,
    send: <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />,
    zap: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5" /><circle cx="12" cy="17" r=".5" fill="currentColor" /></>,
    moreH: <><circle cx="5" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="19" cy="12" r="1.3" fill="currentColor" /></>,
    pound: <><path d="M18 7a4 4 0 0 0-8 0v3H7m5 0v8h8M6 20h5" /></>,
    award: <><circle cx="12" cy="9" r="6" /><path d="M8.2 13.8L7 22l5-3 5 3-1.2-8.2" /></>,
    filter: <path d="M3 4h18l-7 9v7l-4-2v-5L3 4z" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="ico">
      {paths[name] || <circle cx="12" cy="12" r="3" />}
    </svg>
  );
}

const Logo = ({ size = 18, onClick }) => (
  <div className="logo" style={{ fontSize: size, cursor: onClick ? "pointer" : "default" }} onClick={onClick}>
    Supply<span className="ed">ED</span>
  </div>
);

const Avatar = ({ name, size = "md", tone = "" }) => {
  const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2);
  return <div className={`avatar avatar-${size} ${tone ? `avatar-${tone}` : ""}`}>{initials}</div>;
};

const Btn = ({ children, variant = "primary", size = "", icon, iconRight, className = "", style, ...props }) => (
  <button className={`btn btn-${variant} ${size ? `btn-${size}` : ""} ${className}`} style={style} {...props}>
    {icon ? <Icon name={icon} size={14} /> : null}
    {children}
    {iconRight ? <Icon name={iconRight} size={14} /> : null}
  </button>
);

const Tag = ({ tone = "", children, style }) => <span className={`tag ${tone ? `tag-${tone}` : ""}`} style={style}>{children}</span>;
const Chip = ({ active, children, onClick }) => <button type="button" className={`chip ${active ? "active" : ""}`} onClick={onClick}>{children}</button>;
const MatchScore = ({ score, size = 48 }) => <div className={`match-score ${score >= 85 ? "high" : score >= 70 ? "mid" : "low"}`} style={{ width: size, height: size }}>{score}%</div>;
const VerifyBadge = () => <span className="verify-badge"><Icon name="shield" size={11} /> DBS Verified</span>;
const Stars = ({ rating }) => <span className="stars">{"★".repeat(Math.floor(rating))}<span style={{ color: "#e5e7eb" }}>{"★".repeat(5 - Math.floor(rating))}</span></span>;

function Checkbox({ checked, onChange, label }) {
  return (
    <button type="button" onClick={() => onChange?.(!checked)} style={{ border: "none", background: "transparent", display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
      <span className={`checkbox ${checked ? "checked" : ""}`} />
      <span className="sm muted" style={{ color: "var(--slate)" }}>{label}</span>
    </button>
  );
}

const Toggle = ({ on, onChange }) => <div className={`toggle ${on ? "on" : ""}`} onClick={() => onChange?.(!on)} />;
const Field = ({ label, children, hint }) => <div className="field">{label ? <label className="field-label">{label}</label> : null}{children}{hint ? <div className="xs muted" style={{ marginTop: 4 }}>{hint}</div> : null}</div>;
const Stat = ({ value, label, delta }) => <div className="stat"><div className="stat-value">{value}</div><div className="stat-label">{label}</div>{delta ? <div className="stat-delta">{delta}</div> : null}</div>;
const PageHead = ({ title, subtitle, actions }) => <div className="page-title-row"><div><h1 className="page-title">{title}</h1>{subtitle ? <div className="page-subtitle">{subtitle}</div> : null}</div>{actions ? <div className="row gap-8 wrap">{actions}</div> : null}</div>;
const Modal = ({ open, onClose, children }) => open ? <div className="modal-back" onClick={onClose}><div className="modal" onClick={(e) => e.stopPropagation()}>{children}</div></div> : null;
const ToastStack = ({ toasts }) => <div className="toast-stack">{toasts.map((toast) => <div key={toast.id} className="toast"><div className="toast-icon"><Icon name={toast.icon || "check"} size={11} /></div><div><div className="fw-6">{toast.title}</div><div className="sm" style={{ opacity: 0.86 }}>{toast.msg}</div></div></div>)}</div>;

function LandingPage({ onSignup, onLogin }) {
  return (
    <div>
      <div style={{ padding: "16px 48px", display: "flex", alignItems: "center", borderBottom: "0.5px solid var(--border)", background: "#fff" }}>
        <Logo size={20} />
        <div style={{ display: "flex", gap: 8, marginLeft: 48 }}>
          {["For Schools", "For Teachers", "Pricing", "How it works"].map((item) => <div key={item} className="app-nav-link">{item}</div>)}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Btn variant="ghost" size="sm" onClick={onLogin}>Log in</Btn>
          <Btn size="sm" onClick={onSignup}>Get started</Btn>
        </div>
      </div>

      <section style={{ background: "#0a0a0a", color: "#fff", padding: "96px 48px 80px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(0,140,196,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,140,196,0.06) 1px, transparent 1px)", backgroundSize: "56px 56px" }} />
        <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative", display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 64, alignItems: "center" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 24 }}>Infrastructure for school staffing</div>
            <h1 className="h-display" style={{ fontSize: "clamp(44px, 8vw, 64px)", marginBottom: 24 }}>Connecting schools<br />with <em style={{ color: "var(--se)", fontStyle: "italic" }}>brilliant teachers.</em></h1>
            <p style={{ fontSize: 17, color: "rgba(255,255,255,0.7)", lineHeight: 1.65, maxWidth: 540, marginBottom: 36 }}>SupplyED is the marketplace where UK schools find vetted, DBS-checked supply teachers instantly, or through competitive proposals. No agency fees. Full compliance.</p>
            <div className="row gap-12 wrap" style={{ marginBottom: 48 }}>
              <Btn size="xl" onClick={onSignup} iconRight="arrow">I&apos;m a school</Btn>
              <Btn variant="secondary" size="xl" onClick={onSignup} style={{ background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}>I&apos;m a teacher</Btn>
            </div>
            <div className="row gap-24 wrap">
              {[["8,400+", "Verified teachers"], ["2,100+", "Partner schools"], ["94%", "Filled within 2h"], ["4.9★", "Average rating"]].map(([value, label]) => (
                <div key={label}>
                  <div className="h-serif" style={{ fontSize: 28 }}>{value}</div>
                  <div className="xs" style={{ color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card card-pad" style={{ background: "#fff", color: "var(--ink)", boxShadow: "0 40px 80px rgba(0,0,0,0.4)" }}>
            <div className="row between" style={{ marginBottom: 14 }}>
              <div>
                <div className="label-xs" style={{ color: "var(--se)" }}>Urgent - Today</div>
                <div className="h-serif" style={{ fontSize: 20, marginTop: 4 }}>Y6 Maths Cover</div>
                <div className="sm muted">Greenfield Primary - Salford</div>
              </div>
              <Tag tone="red">Urgent</Tag>
            </div>
            <div className="row gap-6 wrap" style={{ marginBottom: 14 }}>
              <span className="pill">Full day</span>
              <span className="pill">£180/day</span>
              <span className="pill">DBS required</span>
            </div>
            <div style={{ borderTop: "0.5px solid var(--border)", paddingTop: 14 }}>
              <div className="label-xs" style={{ marginBottom: 10 }}>Top matches - AI ranked</div>
              {seedTeachers.slice(0, 3).map((teacher) => (
                <div key={teacher.id} className="row gap-10" style={{ padding: "8px 0", borderBottom: "0.5px solid var(--border)" }}>
                  <Avatar name={teacher.name} size="sm" tone={teacher.tone} />
                  <div className="flex-1">
                    <div className="fw-5">{teacher.name}</div>
                    <div className="xs muted">{teacher.role}</div>
                  </div>
                  <MatchScore score={teacher.matchScore} size={36} />
                </div>
              ))}
            </div>
            <Btn className="w-full" style={{ marginTop: 14, width: "100%" }} iconRight="arrow">Invite top 3</Btn>
          </div>
        </div>
      </section>

      <section style={{ padding: "72px 48px", background: "#fff" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div className="eyebrow">How it works</div>
            <h2 className="h-serif" style={{ fontSize: 36, marginTop: 10 }}>Two ways to staff a role.</h2>
            <p className="muted" style={{ marginTop: 8 }}>Post urgently for instant AI matching, or open a brief and review proposals.</p>
          </div>
          <div className="grid-2">
            {[
              { tag: "Instant matching", title: "Same-day cover, solved in minutes", color: "var(--se)", bg: "var(--se-tint)", steps: ["Post an urgent role", "Teachers are ranked instantly", "First accept wins"] },
              { tag: "Freelance briefs", title: "Long-term roles, properly staffed", color: "var(--purple)", bg: "var(--purple-tint)", steps: ["Publish your brief", "Receive proposals", "Compare, message, hire"] },
            ].map((card) => (
              <div key={card.title} className="card card-pad-lg">
                <div className="tag" style={{ background: card.bg, color: card.color, marginBottom: 16 }}>{card.tag}</div>
                <div className="h-serif" style={{ fontSize: 22, marginBottom: 18 }}>{card.title}</div>
                {card.steps.map((step, index) => <div key={step} className="row gap-12" style={{ marginBottom: 12 }}><div style={{ width: 24, height: 24, borderRadius: "50%", background: card.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{index + 1}</div><div>{step}</div></div>)}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function LoginPage({ role, setRole, onLogin, onSwitchSignup }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("sarah.j@email.com");
  const [password, setPassword] = useState("••••••••");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: "100vh" }}>
      <div style={{ background: "#0a0a0a", color: "#fff", padding: "64px 56px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <Logo size={22} />
        <div>
          <div className="eyebrow" style={{ marginBottom: 20 }}>Welcome back</div>
          <h1 className="h-display" style={{ fontSize: 44, marginBottom: 18 }}>The right teacher,<br /><em style={{ color: "var(--se)", fontStyle: "italic" }}>right now.</em></h1>
          <p style={{ color: "rgba(255,255,255,0.6)", maxWidth: 420 }}>Log in to access your dashboard, post vacancies, or browse shift-ready teachers across the UK.</p>
        </div>
        <div className="xs" style={{ color: "rgba(255,255,255,0.4)" }}>© 2026 SupplyED</div>
      </div>
      <div style={{ background: "#fff", padding: "64px 56px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: 380, width: "100%" }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Log in - Step {step} of 2</div>
          <h2 className="h-serif" style={{ fontSize: 30, marginBottom: 8 }}>{step === 1 ? "Sign in to SupplyED" : "Two-factor verification"}</h2>
          <p className="muted" style={{ marginBottom: 28 }}>{step === 1 ? <>No account yet? <span className="se fw-6" onClick={onSwitchSignup} style={{ cursor: "pointer" }}>Sign up free →</span></> : `Code sent to ${email}`}</p>
          {step === 1 ? (
            <>
              <Field label="I am a">
                <div className="grid-2" style={{ gap: 8 }}>
                  {[["institution", "School / MAT", "building"], ["teacher", "Supply teacher", "user"]].map(([value, label, icon]) => (
                    <button key={value} className="btn btn-secondary" style={{ padding: 14, flexDirection: "column", gap: 6, borderColor: role === value ? "var(--se)" : "var(--border-2)", background: role === value ? "var(--se-tint)" : "#fff" }} onClick={() => setRole(value)}>
                      <Icon name={icon} size={18} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Email"><input className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              <Field label="Password"><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
              <div className="row between" style={{ marginBottom: 20 }}><Checkbox checked onChange={() => {}} label="Remember me" /><span className="se fw-6">Forgot password?</span></div>
              <Btn className="w-full" style={{ width: "100%" }} onClick={() => setStep(2)}>Continue</Btn>
            </>
          ) : (
            <>
              <div className="row gap-8" style={{ marginBottom: 20 }}>{Array.from({ length: 6 }).map((_, index) => <input key={index} className="input" defaultValue={index < 3 ? ["3", "7", "1"][index] : ""} style={{ width: 46, height: 56, textAlign: "center", fontSize: 20, padding: 0 }} />)}</div>
              <div className="sm muted" style={{ marginBottom: 24 }}>Didn&apos;t get a code? <span className="se fw-6">Resend</span></div>
              <Btn className="w-full" style={{ width: "100%" }} onClick={onLogin}>Verify and continue</Btn>
              <Btn variant="ghost" className="w-full" style={{ width: "100%", marginTop: 8 }} onClick={() => setStep(1)}>Back</Btn>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function OnboardingPage({ step, setStep, onFinish }) {
  const steps = ["Account", "Profile", "Documents", "Review"];
  return (
    <div>
      <div style={{ padding: "20px 40px", background: "#fff", borderBottom: "0.5px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Logo />
        <div className="steps">
          {steps.map((label, index) => (
            <div key={label} className="row gap-6">
              <div className={`step ${index + 1 < step ? "done" : index + 1 === step ? "active" : ""}`}>{index + 1 < step ? <Icon name="check" size={12} /> : index + 1}</div>
              {index < steps.length - 1 ? <div className={`step-bar ${index + 1 < step ? "done" : ""}`} /> : null}
            </div>
          ))}
        </div>
      </div>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 32px" }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>{steps[step - 1]}</div>
        <h1 className="h-serif" style={{ fontSize: 36, marginBottom: 10 }}>{["Create your account", "Build your profile", "Upload documents", "Review and submit"][step - 1]}</h1>
        {step === 1 ? <div className="card card-pad-lg"><div className="grid-2"><Field label="Full name"><input className="input" defaultValue="Sarah Johnson" /></Field><Field label="Work email"><input className="input" defaultValue="sarah.j@email.com" /></Field><Field label="Phone"><input className="input" placeholder="+44 7700 900000" /></Field><Field label="Postcode"><input className="input" placeholder="M1 1AE" /></Field><Field label="Password"><input className="input" type="password" /></Field><Field label="Confirm password"><input className="input" type="password" /></Field></div></div> : null}
        {step === 2 ? <div className="card card-pad-lg"><Field label="Primary subjects"><div className="row gap-6 wrap">{["Maths", "English", "Science", "Humanities", "All Primary"].map((item, index) => <Chip key={item} active={index < 2}>{item}</Chip>)}</div></Field><Field label="Key stages"><div className="row gap-6 wrap">{["EYFS", "KS1", "KS2", "KS3", "KS4", "KS5"].map((item, index) => <Chip key={item} active={index === 2 || index === 3}>{item}</Chip>)}</div></Field><Field label="About you"><textarea className="textarea" defaultValue="Enthusiastic KS2 & KS3 Mathematics specialist. Structured but engaging lessons. Experienced with SEN students." /></Field></div> : null}
        {step === 3 ? <div className="card card-pad-lg"><div className="grid-2">{[["Enhanced DBS Certificate", "uploaded"], ["Photo ID", "uploaded"], ["QTS Certificate", "none"], ["Right to Work in UK", "pending"]].map(([name, status]) => <div key={name} className="row gap-10" style={{ padding: "12px 14px", border: "0.5px solid var(--border)", borderRadius: 8, background: status === "uploaded" ? "var(--green-tint)" : status === "pending" ? "var(--amber-tint)" : "#fff" }}><Icon name={status === "uploaded" ? "checkCircle" : "file"} size={18} /><div className="flex-1"><div className="fw-5">{name}</div><div className="xs muted">PDF or image</div></div><Btn variant={status === "uploaded" ? "ghost" : "secondary"} size="sm">{status === "uploaded" ? "Uploaded" : status === "pending" ? "Review" : "Upload"}</Btn></div>)}</div></div> : null}
        {step === 4 ? <div className="card card-pad-lg">{[["Name", "Sarah Johnson"], ["Email", "sarah.j@email.com"], ["Subjects", "Maths, Science"], ["Key stages", "KS2, KS3"], ["Documents", "2 of 3 required uploaded"]].map(([key, value]) => <div key={key} className="row" style={{ padding: "12px 0", borderBottom: "0.5px solid var(--border)" }}><div style={{ width: 140 }} className="xs muted">{key}</div><div className="flex-1">{value}</div><span className="xs se fw-6">Edit</span></div>)}</div> : null}
        <div className="row between" style={{ marginTop: 28 }}>
          <Btn variant="ghost" disabled={step === 1} onClick={() => setStep(Math.max(1, step - 1))}>Back</Btn>
          <Btn size="lg" iconRight="arrow" onClick={() => step === 4 ? onFinish() : setStep(step + 1)}>{step === 4 ? "Submit for review" : "Continue"}</Btn>
        </div>
      </div>
    </div>
  );
}

function InstitutionDashboard({ go, toast, tweaks }) {
  return (
    <>
      {tweaks.urgentBanner ? <div className="urgent-banner"><Icon name="zap" size={16} /><strong>2 unfilled roles tomorrow.</strong><span style={{ opacity: 0.8 }}>Post an urgent cover or invite top matches.</span><div style={{ marginLeft: "auto", display: "flex", gap: 8 }}><Btn variant="danger" size="sm" onClick={() => go("post-job")}>Post urgent</Btn></div></div> : null}
      <div className="app-page">
        <PageHead title="Good morning, Greenfield" subtitle="Tuesday, 24 March 2026 - 3 active jobs - 2 roles unfilled for tomorrow" actions={<><Btn variant="secondary" icon="download">Export</Btn><Btn icon="plus" onClick={() => go("post-job")}>Post a job</Btn></>} />
        <div className="grid-4" style={{ marginBottom: 28 }}>
          <Stat value="3" label="Active jobs" delta="2 open" />
          <Stat value="18" label="Applicants this week" delta="+6 today" />
          <Stat value="12" label="Teachers shortlisted" delta="4 new" />
          <Stat value="£1,840" label="Month-to-date spend" delta="-8% vs Feb" />
        </div>
        <div className="two-col">
          <div>
            <div className="row between" style={{ marginBottom: 14 }}><div className="section-title" style={{ marginBottom: 0 }}>Active job posts</div><span className="xs se fw-6" onClick={() => go("applications")}>View all →</span></div>
            <div className="card" style={{ overflow: "hidden" }}>
              {seedJobs.map((job) => (
                <div key={job.id} className="row gap-16" style={{ padding: "16px 20px", borderBottom: "0.5px solid var(--border)", cursor: "pointer" }} onClick={() => go("applications", { jobId: job.id })}>
                  <div className="flex-1">
                    <div className="row gap-8" style={{ marginBottom: 4 }}>{job.urgent ? <Tag tone="red">Urgent</Tag> : null}<Tag tone={job.mode === "instant" ? "" : "purple"}>{job.mode === "instant" ? "Instant" : "Brief"}</Tag><span className="xs muted">{job.postedAt}</span></div>
                    <div className="fw-6" style={{ fontSize: 15 }}>{job.title}</div>
                    <div className="xs muted">{job.school} - {job.date} - £{job.rate}/day</div>
                  </div>
                  <div style={{ textAlign: "center" }}><div className="h-serif" style={{ fontSize: 22, color: "var(--se)" }}>{job.applicants}</div><div className="xs muted">Applicants</div></div>
                </div>
              ))}
            </div>
            <div className="section-title" style={{ marginTop: 28 }}>Recent activity</div>
            <div className="card card-pad">{[
              "Sarah Johnson applied to Y6 Maths cover",
              "Priya Mehta accepted the interview invitation",
              "Marcus Webb sent a message",
              "Invoice #INV-2041 generated",
            ].map((entry) => <div key={entry} className="row between" style={{ padding: "10px 0", borderBottom: "0.5px solid var(--border)" }}><div>{entry}</div><div className="xs muted">Today</div></div>)}</div>
          </div>
          <div>
            <div className="section-title">Top matches today</div>
            <div className="card" style={{ overflow: "hidden" }}>
              {seedTeachers.slice(0, 4).map((teacher, index) => <div key={teacher.id} className="row gap-10" style={{ padding: "12px 14px", borderBottom: index < 3 ? "0.5px solid var(--border)" : "none", cursor: "pointer" }} onClick={() => go("teacher-profile", { teacherId: teacher.id })}><Avatar name={teacher.name} tone={teacher.tone} /><div className="flex-1"><div className="fw-5">{teacher.name}</div><div className="xs muted">{teacher.role}</div></div><MatchScore score={teacher.matchScore} size={38} /></div>)}
            </div>
            <div className="section-title" style={{ marginTop: 28 }}>Quick actions</div>
            <div className="card card-pad col gap-8">
              <Btn icon="plus" style={{ justifyContent: "flex-start" }} onClick={() => go("post-job")}>Post a job</Btn>
              <Btn variant="secondary" icon="search" style={{ justifyContent: "flex-start" }} onClick={() => go("find-teachers")}>Browse teachers</Btn>
              <Btn variant="secondary" icon="message" style={{ justifyContent: "flex-start" }} onClick={() => go("messaging")}>Open messages</Btn>
              <Btn variant="secondary" icon="file" style={{ justifyContent: "flex-start" }} onClick={() => go("billing")}>View invoices</Btn>
            </div>
            <div className="section-title" style={{ marginTop: 28 }}>Your plan</div>
            <div className="card card-pad" style={{ borderColor: "var(--se)", background: "var(--se-tint)" }}>
              <Tag>Pro - Active</Tag>
              <div className="h-serif" style={{ fontSize: 22, marginTop: 10 }}>£99 / month</div>
              <div className="xs muted" style={{ marginTop: 4 }}>Renews 24 Apr 2026</div>
              <div className="progress" style={{ marginTop: 14 }}><div className="progress-fill" style={{ width: "58%" }} /></div>
              <Btn variant="ink" size="sm" style={{ width: "100%", marginTop: 14 }} onClick={() => go("billing")}>Manage plan</Btn>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function PostJobPage({ go, toast }) {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState("instant");
  const [form, setForm] = useState({ title: "", keyStage: "KS2", subject: "Maths", startDate: "Tomorrow, Wed 25 Mar", duration: "1 day", rate: 180, urgent: false, dbsRequired: true, qtsRequired: false });
  const publish = () => {
    toast({ title: "Job posted", msg: "AI matching started - 6 candidates notified." });
    go("applications", { jobId: "j-101" });
  };
  return (
    <div className="app-page">
      <PageHead title="Post a new role" subtitle="Most posts take under 60 seconds. Urgent posts are instantly matched to available teachers." />
      <div className="row gap-10 wrap" style={{ marginBottom: 28 }}>{["Type", "Details", "Requirements", "Review"].map((label, index) => <div key={label} className="row gap-8"><div className={`step ${index + 1 < step ? "done" : index + 1 === step ? "active" : ""}`}>{index + 1}</div><span className={index + 1 === step ? "fw-6" : "muted"}>{label}</span>{index < 3 ? <div className={`step-bar ${index + 1 < step ? "done" : ""}`} /> : null}</div>)}</div>
      <div className="card card-pad-lg" style={{ maxWidth: 920 }}>
        {step === 1 ? <div><div className="eyebrow" style={{ marginBottom: 10 }}>Step 1 - Posting type</div><h2 className="h-serif" style={{ fontSize: 26, marginBottom: 20 }}>How do you want to staff this role?</h2><div className="grid-2">{[{ value: "instant", title: "Instant matching", desc: "Best for urgent or same-day cover.", color: "var(--se)", bg: "var(--se-tint)" }, { value: "brief", title: "Open brief", desc: "Best for long-term and competitive proposals.", color: "var(--purple)", bg: "var(--purple-tint)" }].map((option) => <div key={option.value} onClick={() => setMode(option.value)} style={{ padding: 20, borderRadius: 12, border: `1.5px solid ${mode === option.value ? option.color : "var(--border)"}`, background: mode === option.value ? option.bg : "#fff", cursor: "pointer" }}><div className="h-serif" style={{ fontSize: 20, marginBottom: 8 }}>{option.title}</div><div className="muted">{option.desc}</div></div>)}</div></div> : null}
        {step === 2 ? <div><Field label="Job title"><input className="input" placeholder="e.g. Y6 Maths Cover - 1 day" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field><div className="grid-2"><Field label="Key stage"><select className="select" value={form.keyStage} onChange={(e) => setForm({ ...form, keyStage: e.target.value })}><option>KS1</option><option>KS2</option><option>KS3</option><option>KS4</option><option>KS5</option></select></Field><Field label="Subject"><select className="select" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}><option>Maths</option><option>English</option><option>Science</option><option>All Primary</option></select></Field><Field label="Start date"><input className="input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field><Field label="Day rate (£)"><input className="input" type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: Number(e.target.value) })} /></Field></div><Field label="Description"><textarea className="textarea" defaultValue="Covering Y6 Maths for the day. Lesson plans will be provided on arrival. Class of 28 pupils, well-behaved. Parking available on-site." /></Field><Checkbox checked={form.urgent} onChange={(value) => setForm({ ...form, urgent: value })} label="Mark as urgent" /></div> : null}
        {step === 3 ? <div><Field label="Required qualifications"><div className="col gap-8"><Checkbox checked={form.dbsRequired} onChange={(value) => setForm({ ...form, dbsRequired: value })} label="Enhanced DBS Certificate" /><Checkbox checked={form.qtsRequired} onChange={(value) => setForm({ ...form, qtsRequired: value })} label="QTS qualified" /><Checkbox checked={false} onChange={() => {}} label="SEN experience" /></div></Field><Field label="Minimum experience"><div className="row gap-8 wrap">{["Any", "ECT welcome", "1+ year", "3+ years", "5+ years"].map((item, index) => <Chip key={item} active={index === 2}>{item}</Chip>)}</div></Field></div> : null}
        {step === 4 ? <div><div className="eyebrow" style={{ marginBottom: 10 }}>Step 4 - Review</div><div className="card card-pad" style={{ background: "var(--chalk)" }}><div className="row gap-8 wrap" style={{ marginBottom: 10 }}><Tag tone={mode === "instant" ? "" : "purple"}>{mode === "instant" ? "Instant matching" : "Open brief"}</Tag>{form.urgent ? <Tag tone="red">Urgent</Tag> : null}</div><div className="h-serif" style={{ fontSize: 22 }}>{form.title || "Y6 Maths Cover - 1 day"}</div><div className="row gap-8 wrap" style={{ marginTop: 10 }}><span className="pill">{form.keyStage}</span><span className="pill">{form.subject}</span><span className="pill">£{form.rate}/day</span>{form.dbsRequired ? <span className="pill">DBS required</span> : null}</div></div></div> : null}
        <div className="row between" style={{ marginTop: 32 }}><Btn variant="ghost" onClick={() => step > 1 ? setStep(step - 1) : go("dashboard")}>{step > 1 ? "Back" : "Cancel"}</Btn><Btn size="lg" iconRight={step === 4 ? "send" : "arrow"} onClick={() => step < 4 ? setStep(step + 1) : publish()}>{step < 4 ? "Continue" : "Publish job"}</Btn></div>
      </div>
    </div>
  );
}

function ApplicationsPage({ go, ctx }) {
  const jobId = ctx.jobId || "j-101";
  const job = seedJobs.find((item) => item.id === jobId) || seedJobs[0];
  const [view, setView] = useState("kanban");
  const apps = seedApplications.filter((application) => application.jobId === job.id).map((application) => ({ ...application, teacher: seedTeachers.find((teacher) => teacher.id === application.teacherId) }));
  const stages = ["applied", "shortlisted", "interview", "hired"];
  return (
    <div className="app-page">
      <PageHead title={job.title} subtitle={`${job.school} - ${job.date} - £${job.rate}/day - ${apps.length} applications`} actions={<><Btn variant="secondary" size="sm">Message all</Btn><Btn variant="secondary" size="sm">Edit job</Btn><Btn size="sm">Close position</Btn></>} />
      <div className="card card-pad row gap-20 wrap" style={{ marginBottom: 24 }}>
        <div className="row gap-8">{job.urgent ? <Tag tone="red">Urgent</Tag> : null}<Tag tone={job.mode === "instant" ? "" : "purple"}>{job.mode}</Tag></div>
        <div><div className="xs muted">Applicants</div><div className="h-serif" style={{ fontSize: 22 }}>{apps.length}</div></div>
        <div><div className="xs muted">Shortlisted</div><div className="h-serif" style={{ fontSize: 22 }}>{apps.filter((item) => item.stage === "shortlisted").length}</div></div>
        <div style={{ marginLeft: "auto" }} className="row gap-6"><Btn variant={view === "kanban" ? "secondary" : "ghost"} size="sm" icon="grid" onClick={() => setView("kanban")}>Kanban</Btn><Btn variant={view === "list" ? "secondary" : "ghost"} size="sm" icon="list" onClick={() => setView("list")}>List</Btn></div>
      </div>
      {view === "kanban" ? <div className="kanban">{stages.map((stage) => <div key={stage} className="kanban-col"><div className="kanban-head"><div className="label-xs">{stage}</div><div className="pill">{apps.filter((item) => item.stage === stage).length}</div></div>{apps.filter((item) => item.stage === stage).map((application) => <div key={application.id} className="kanban-card" onClick={() => go("teacher-profile", { teacherId: application.teacher.id })}><div className="row gap-8" style={{ marginBottom: 8 }}><Avatar name={application.teacher.name} size="sm" tone={application.teacher.tone} /><div className="flex-1"><div className="fw-5">{application.teacher.name}</div><div className="xs muted">{application.teacher.role}</div></div><MatchScore score={application.teacher.matchScore} size={32} /></div><div className="xs muted" style={{ marginBottom: 8 }}>{`"${application.coverLetter.slice(0, 72)}..."`}</div><div className="row between"><span className="xs fw-6 se">£{application.rate}/day</span><span className="xs muted">{application.appliedAt}</span></div></div>)}</div>)}</div> : <div className="card" style={{ overflow: "hidden" }}><table className="tbl"><thead><tr><th>Teacher</th><th>Rate</th><th>Match</th><th>Stage</th><th>Applied</th></tr></thead><tbody>{apps.map((application) => <tr key={application.id}><td><div className="row gap-10"><Avatar name={application.teacher.name} size="sm" tone={application.teacher.tone} /><div><div className="fw-5">{application.teacher.name}</div><div className="xs muted">{application.teacher.role}</div></div></div></td><td>£{application.rate}</td><td><MatchScore score={application.teacher.matchScore} size={36} /></td><td><Tag tone={application.stage === "interview" ? "purple" : application.stage === "shortlisted" ? "" : "ghost"}>{application.stage}</Tag></td><td>{application.appliedAt}</td></tr>)}</tbody></table></div>}
    </div>
  );
}

function FindTeachersPage({ go, toast }) {
  const [query, setQuery] = useState("");
  const results = seedTeachers.filter((teacher) => teacher.name.toLowerCase().includes(query.toLowerCase()) || teacher.role.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="app-page">
      <PageHead title="Find teachers" subtitle="Browse the full teacher network. Filter, shortlist, invite." actions={<Btn icon="plus" onClick={() => go("post-job")}>Post a job</Btn>} />
      <div className="three-panel">
        <div className="card card-pad" style={{ alignSelf: "start" }}>
          <div className="label-xs" style={{ marginBottom: 12 }}>Filters</div>
          <Field label="Key stage"><div className="row gap-6 wrap">{["KS1", "KS2", "KS3", "KS4", "KS5"].map((item, index) => <Chip key={item} active={index === 1 || index === 2}>{item}</Chip>)}</div></Field>
          <Field label="Subject"><select className="select"><option>All subjects</option><option>Maths</option><option>English</option><option>Science</option></select></Field>
          <div className="col gap-8"><Checkbox checked onChange={() => {}} label="DBS verified only" /><Checkbox checked={false} onChange={() => {}} label="QTS qualified" /><Checkbox checked={false} onChange={() => {}} label="Available today" /></div>
        </div>
        <div>
          <div className="row gap-10" style={{ marginBottom: 18 }}>
            <div className="row gap-6" style={{ flex: 1, background: "#fff", border: "0.5px solid var(--border-2)", borderRadius: 8, padding: "10px 14px" }}><Icon name="search" size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, subject, school..." style={{ flex: 1, border: "none", outline: "none", background: "transparent" }} /></div>
            <select className="select" style={{ width: 180 }}><option>Sort: Best match</option><option>Sort: Rating</option></select>
          </div>
          <div className="col gap-12">
            {results.map((teacher) => <div key={teacher.id} className="card card-pad row gap-20 wrap" style={{ cursor: "pointer" }} onClick={() => go("teacher-profile", { teacherId: teacher.id })}><Avatar name={teacher.name} size="lg" tone={teacher.tone} /><div className="flex-1"><div className="row gap-8 wrap" style={{ marginBottom: 4 }}><div className="h-serif" style={{ fontSize: 18 }}>{teacher.name}</div>{teacher.dbs ? <VerifyBadge /> : null}{teacher.qts ? <Tag tone="ghost">QTS</Tag> : null}</div><div className="md muted">{teacher.role}</div><div className="row gap-12 wrap" style={{ marginTop: 8 }}><div className="row gap-4 xs muted"><Icon name="pin" size={12} />{teacher.city} - {teacher.distance}</div><div className="row gap-4 xs"><Stars rating={teacher.rating} />{teacher.rating} ({teacher.reviews})</div><div className="row gap-4 xs muted"><Icon name="clock" size={12} />Available {teacher.availability}</div></div></div><div style={{ textAlign: "center" }}><div className="h-serif" style={{ fontSize: 18 }}>£{teacher.rate}</div><div className="xs muted">per day</div></div><MatchScore score={teacher.matchScore} /><div className="col gap-6"><Btn size="sm" onClick={(e) => { e.stopPropagation(); toast({ title: "Invited", msg: `${teacher.name} has been invited to apply.` }); }}>Invite</Btn><Btn variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); go("messaging"); }}>Message</Btn></div></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function TeacherDashboard({ go }) {
  return (
    <div className="app-page">
      <PageHead title="Morning, Sarah" subtitle="Tuesday, 24 March 2026 - 3 new job matches - 1 booking confirmed" actions={<><Btn variant="secondary" icon="calendar" onClick={() => go("calendar")}>My calendar</Btn><Btn icon="search" onClick={() => go("find-jobs")}>Find jobs</Btn></>} />
      <div className="grid-4" style={{ marginBottom: 28 }}>
        <Stat value="£3,240" label="Earned this month" delta="+£185 yesterday" />
        <Stat value="12" label="Days booked" delta="3 this week" />
        <Stat value="4.9★" label="Average rating" delta="47 reviews" />
        <Stat value="92%" label="Profile strength" delta="Upload QTS to reach 100%" />
      </div>
      <div className="two-col">
        <div>
          <div className="section-title">Up next</div>
          <div className="card card-pad-lg" style={{ background: "linear-gradient(135deg, #008CC4 0%, #006E9A 100%)", color: "#fff", marginBottom: 28 }}>
            <div className="row between" style={{ marginBottom: 14 }}><Tag style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}>Confirmed</Tag><span className="xs" style={{ opacity: 0.8 }}>Tomorrow - 08:20 arrival</span></div>
            <div className="h-serif" style={{ fontSize: 26, marginBottom: 8 }}>Y6 Maths Cover - Full day</div>
            <div className="md" style={{ opacity: 0.9, marginBottom: 16 }}>Greenfield Primary - Salford - M5 4AZ</div>
            <div className="row gap-16 wrap"><div><div className="xs" style={{ opacity: 0.7 }}>Earnings</div><div className="h-serif" style={{ fontSize: 22 }}>£180</div></div><div><div className="xs" style={{ opacity: 0.7 }}>Hours</div><div className="h-serif" style={{ fontSize: 22 }}>6.5h</div></div><div><div className="xs" style={{ opacity: 0.7 }}>Key stage</div><div className="h-serif" style={{ fontSize: 22 }}>KS2</div></div></div>
          </div>
          <div className="section-title">Recommended for you</div>
          <div className="col gap-12">{seedJobs.map((job) => <div key={job.id} className="card card-pad row gap-16 wrap" style={{ cursor: "pointer" }} onClick={() => go("job-detail", { jobId: job.id })}><div className="flex-1"><div className="row gap-6 wrap" style={{ marginBottom: 2 }}>{job.urgent ? <Tag tone="red">Urgent</Tag> : null}<Tag tone="ghost">{job.keyStage}</Tag><Tag tone="ghost">{job.subject}</Tag></div><div className="md fw-6">{job.title}</div><div className="xs muted">{job.school} - {job.city} - {job.date}</div></div><div style={{ textAlign: "right" }}><div className="h-serif" style={{ fontSize: 18 }}>£{job.rate}</div><div className="xs muted">per day</div></div><MatchScore score={job.matchScore} /><Btn size="sm">View</Btn></div>)}</div>
        </div>
        <div>
          <div className="section-title">Profile strength</div>
          <div className="card card-pad"><div className="row between" style={{ marginBottom: 10 }}><div className="h-serif" style={{ fontSize: 28 }}>92%</div><Tag tone="green">Strong</Tag></div><div className="progress" style={{ marginBottom: 14 }}><div className="progress-fill" style={{ width: "92%" }} /></div>{["Upload QTS Certificate", "Add profile photo", "Complete About you", "Add 2 references"].map((item, index) => <div key={item} className="row gap-8" style={{ padding: "6px 0" }}><Icon name={index < 2 ? "checkCircle" : "plus"} size={14} /><span className={index < 2 ? "sm muted" : "sm"}>{item}</span></div>)}</div>
          <div className="section-title" style={{ marginTop: 28 }}>Messages</div>
          <div className="card" style={{ overflow: "hidden" }}>{seedMessages.map((message, index) => <div key={message.id} className="msg-list-item" style={{ borderBottom: index < seedMessages.length - 1 ? "0.5px solid var(--border)" : "none" }} onClick={() => go("messaging")}><Avatar name={message.with} size="sm" tone={message.tone} /><div className="flex-1"><div className="fw-5">{message.with}</div><div className="xs muted">{message.lastMsg}</div></div>{message.unread ? <div className="tag">{message.unread}</div> : null}</div>)}</div>
        </div>
      </div>
    </div>
  );
}

function FindJobsPage({ go }) {
  const [mode, setMode] = useState("all");
  const jobs = mode === "urgent" ? seedJobs.filter((job) => job.urgent) : seedJobs;
  return (
    <div className="app-page">
      <PageHead title="Find jobs" subtitle={`${seedJobs.length} open roles near you - ranked by match score`} />
      <div className="row gap-8 wrap" style={{ marginBottom: 20 }}>
        <Chip active={mode === "all"} onClick={() => setMode("all")}>All {seedJobs.length}</Chip>
        <Chip active={mode === "urgent"} onClick={() => setMode("urgent")}>Urgent {seedJobs.filter((job) => job.urgent).length}</Chip>
        <Chip>KS2</Chip>
        <Chip>Maths</Chip>
      </div>
      <div className="two-col">
        <div className="col gap-12">{jobs.map((job) => <div key={job.id} className="card card-pad-lg row gap-20 wrap" style={{ cursor: "pointer" }} onClick={() => go("job-detail", { jobId: job.id })}><div className="flex-1"><div className="row gap-6 wrap" style={{ marginBottom: 6 }}>{job.urgent ? <Tag tone="red">Urgent</Tag> : null}<Tag tone={job.mode === "instant" ? "" : "purple"}>{job.mode === "instant" ? "Instant" : "Brief"}</Tag><Tag tone="ghost">{job.keyStage}</Tag><span className="xs muted">Posted {job.postedAt}</span></div><div className="h-serif" style={{ fontSize: 20, marginBottom: 4 }}>{job.title}</div><div className="md muted" style={{ marginBottom: 12 }}>{job.school} - {job.city} - {job.date}</div><div className="row gap-16 wrap"><div className="row gap-4 xs muted"><Icon name="pound" size={12} />£{job.rate}/day</div><div className="row gap-4 xs muted"><Icon name="users" size={12} />{job.applicants} applied</div><div className="row gap-4 xs muted"><Icon name="pin" size={12} />4.2 mi</div></div></div><div className="col" style={{ alignItems: "flex-end", gap: 10 }}><MatchScore score={job.matchScore} /><Btn size="sm">{job.mode === "instant" ? "Accept" : "Apply"}</Btn></div></div>)}</div>
        <div className="card card-pad">
          <div className="eyebrow" style={{ marginBottom: 10 }}>Map view</div>
          <div style={{ aspectRatio: "4/5", background: "linear-gradient(135deg, #E5F4FA 0%, #F8F8F8 100%)", borderRadius: 8, position: "relative", overflow: "hidden" }}>{[[30, 25], [55, 40], [40, 65], [70, 55]].map(([x, y], index) => <div key={index} style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -100%)" }}><div style={{ width: 26, height: 26, borderRadius: "50% 50% 50% 0", background: index === 0 ? "var(--red)" : "var(--se)", transform: "rotate(-45deg)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9, fontWeight: 700 }}><span style={{ transform: "rotate(45deg)" }}>£{seedJobs[index].rate}</span></div></div>)}</div>
        </div>
      </div>
    </div>
  );
}

function JobDetailPage({ ctx, go, toast, role }) {
  const job = seedJobs.find((item) => item.id === (ctx.jobId || "j-101")) || seedJobs[0];
  const [open, setOpen] = useState(false);
  return (
    <div className="app-page">
      <div className="two-col">
        <div>
          <div className="row gap-6 wrap" style={{ marginBottom: 14 }}>{job.urgent ? <Tag tone="red">Urgent - act fast</Tag> : null}<Tag tone={job.mode === "instant" ? "" : "purple"}>{job.mode === "instant" ? "Instant matching" : "Open brief"}</Tag><Tag tone="ghost">{job.keyStage}</Tag><Tag tone="ghost">{job.subject}</Tag></div>
          <h1 className="h-display" style={{ fontSize: 38, marginBottom: 10 }}>{job.title}</h1>
          <div className="row gap-16 wrap" style={{ marginBottom: 24 }}><div className="row gap-6"><Icon name="building" size={14} />{job.school}</div><div className="row gap-6"><Icon name="pin" size={14} />{job.city}</div><div className="row gap-6"><Icon name="clock" size={14} />Posted {job.postedAt}</div></div>
          <div className="grid-3" style={{ marginBottom: 28 }}>
            <div className="card card-pad" style={{ textAlign: "center" }}><div className="xs muted">Day rate</div><div className="h-serif" style={{ fontSize: 26, color: "var(--se)" }}>£{job.rate}</div></div>
            <div className="card card-pad" style={{ textAlign: "center" }}><div className="xs muted">Duration</div><div className="h-serif" style={{ fontSize: 20 }}>1 Day</div></div>
            <div className="card card-pad" style={{ textAlign: "center" }}><div className="xs muted">Match score</div><div style={{ display: "flex", justifyContent: "center", marginTop: 6 }}><MatchScore score={job.matchScore} /></div></div>
          </div>
          <div className="card card-pad-lg" style={{ marginBottom: 20 }}><div className="section-title">About this role</div><p style={{ lineHeight: 1.7 }}>{job.description}</p></div>
          <div className="card card-pad-lg"><div className="section-title">Requirements</div>{["Enhanced DBS certificate", "QTS not required", "Subject: Maths", "Available from 08:20 tomorrow"].map((item) => <div key={item} className="row gap-10" style={{ padding: "8px 0" }}><Icon name="checkCircle" size={16} />{item}</div>)}</div>
        </div>
        <div className="card card-pad-lg" style={{ alignSelf: "start", position: "sticky", top: 88 }}>
          <div className="row between" style={{ marginBottom: 14 }}><div><div className="xs muted">Day rate</div><div className="h-serif" style={{ fontSize: 28 }}>£{job.rate}</div></div><MatchScore score={job.matchScore} /></div>
          <div className="row gap-8 wrap" style={{ marginBottom: 14 }}><span className="pill">{job.keyStage}</span><span className="pill">{job.subject}</span><span className="pill">{job.date}</span></div>
          <Btn style={{ width: "100%" }} size="lg" onClick={() => setOpen(true)}>{role === "teacher" ? (job.mode === "instant" ? "Accept job" : "Apply now") : "Invite candidates"}</Btn>
          <Btn variant="secondary" style={{ width: "100%", marginTop: 8 }} onClick={() => go("messaging")}>Message school</Btn>
        </div>
      </div>
      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="card-pad-lg">
          <div className="h-serif" style={{ fontSize: 26, marginBottom: 8 }}>{role === "teacher" ? "Apply to this role" : "Invite candidates"}</div>
          <Field label="Message"><textarea className="textarea" defaultValue="Hi, I'm available and happy to arrive by 08:15. I have strong KS2 Maths cover experience." /></Field>
          <div className="row between"><Btn variant="ghost" onClick={() => setOpen(false)}>Cancel</Btn><Btn onClick={() => { setOpen(false); toast({ title: "Success", msg: role === "teacher" ? "Application submitted." : "Top candidates invited." }); }}>Confirm</Btn></div>
        </div>
      </Modal>
    </div>
  );
}

function TeacherProfilePage({ ctx, go }) {
  const teacher = seedTeachers.find((item) => item.id === (ctx.teacherId || "t-sarah")) || seedTeachers[0];
  return (
    <div className="app-page">
      <div className="two-col">
        <div>
          <div className="card card-pad-lg" style={{ marginBottom: 20 }}>
            <div className="row gap-16 wrap">
              <Avatar name={teacher.name} size="lg" tone={teacher.tone} />
              <div className="flex-1">
                <div className="row gap-8 wrap" style={{ marginBottom: 6 }}><h1 className="h-serif" style={{ fontSize: 32 }}>{teacher.name}</h1>{teacher.dbs ? <VerifyBadge /> : null}{teacher.qts ? <Tag tone="ghost">QTS</Tag> : null}</div>
                <div className="md muted">{teacher.role}</div>
                <div className="row gap-16 wrap" style={{ marginTop: 12 }}><div className="row gap-4"><Icon name="pin" size={12} />{teacher.city}</div><div className="row gap-4"><Stars rating={teacher.rating} />{teacher.rating} ({teacher.reviews})</div><div className="row gap-4"><Icon name="clock" size={12} />Available {teacher.availability}</div></div>
              </div>
              <MatchScore score={teacher.matchScore} />
            </div>
          </div>
          <div className="card card-pad-lg" style={{ marginBottom: 20 }}><div className="section-title">About</div><p style={{ lineHeight: 1.7 }}>Enthusiastic and experienced supply teacher specialising in KS2 and KS3 Mathematics. Structured but engaging approach to lessons, always comes prepared. Experienced with SEN students.</p></div>
          <div className="card card-pad-lg"><div className="section-title">Subjects & stages</div><div className="row gap-8 wrap">{teacher.subjects.map((subject) => <span className="pill" key={subject}>{subject}</span>)}{teacher.keyStages.map((stage) => <span className="pill" key={stage}>{stage}</span>)}</div></div>
        </div>
        <div>
          <div className="card card-pad-lg"><div className="h-serif" style={{ fontSize: 26 }}>£{teacher.rate}</div><div className="xs muted">per day</div><div className="section-title" style={{ marginTop: 20 }}>Quick actions</div><div className="col gap-8"><Btn onClick={() => go("messaging")}>Message</Btn><Btn variant="secondary">Invite to job</Btn><Btn variant="secondary">Download CV</Btn></div></div>
        </div>
      </div>
    </div>
  );
}

function MessagingPage({ state, setState, role }) {
  const activeMessage = seedMessages.find((item) => item.id === state.selectedMessage) || seedMessages[0];
  return (
    <div className="app-page">
      <PageHead title="Messages" subtitle={role === "teacher" ? "Stay in touch with schools and placement details." : "Coordinate quickly with candidates and schools."} />
      <div className="three-panel">
        <div className="card" style={{ overflow: "hidden" }}>
          {seedMessages.map((message) => <div key={message.id} className={`msg-list-item ${activeMessage.id === message.id ? "active" : ""}`} onClick={() => setState((current) => ({ ...current, selectedMessage: message.id }))}><Avatar name={message.with} size="sm" tone={message.tone} /><div className="flex-1"><div className="fw-5">{message.with}</div><div className="xs muted">{message.lastMsg}</div></div><div className="xs muted">{message.time}</div></div>)}
        </div>
        <div className="card card-pad-lg">
          <div className="row between" style={{ marginBottom: 18 }}><div className="row gap-10"><Avatar name={activeMessage.with} size="md" tone={activeMessage.tone} /><div><div className="fw-6">{activeMessage.with}</div><div className="xs muted">Active now</div></div></div><Btn variant="ghost" size="sm" icon="moreH">More</Btn></div>
          <div className="col gap-10" style={{ minHeight: 380 }}>{activeMessage.thread.map((item, index) => <div key={index} className={`msg-bubble ${item.from === "me" ? "out" : "in"}`}>{item.text}<div className="xs" style={{ marginTop: 6, opacity: 0.7 }}>{item.time}</div></div>)}</div>
          <div className="row gap-8" style={{ marginTop: 20 }}><input className="input" placeholder="Write a message..." /><Btn icon="send">Send</Btn></div>
        </div>
      </div>
    </div>
  );
}

function CalendarPage() {
  const days = Array.from({ length: 35 }).map((_, index) => ({ day: index < 2 ? "" : index - 1, state: index === 8 || index === 12 ? "booked" : index === 15 || index === 16 || index === 20 ? "available" : "unavailable" }));
  return (
    <div className="app-page">
      <PageHead title="Availability calendar" subtitle="Control when you appear in instant matching and freelance briefs." actions={<Btn>Save changes</Btn>} />
      <div className="two-col">
        <div className="card card-pad-lg">
          <div className="row between" style={{ marginBottom: 18 }}><div className="h-serif" style={{ fontSize: 24 }}>March 2026</div><div className="row gap-8"><Btn variant="ghost" size="sm">Prev</Btn><Btn variant="ghost" size="sm">Next</Btn></div></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <div key={day} className="xs muted" style={{ padding: "8px 0", textAlign: "center" }}>{day}</div>)}{days.map((item, index) => <div key={index} style={{ aspectRatio: "1", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", border: item.day ? "0.5px solid var(--border)" : "none", background: item.state === "available" ? "var(--se-tint)" : item.state === "booked" ? "var(--ink)" : "#fff", color: item.state === "booked" ? "#fff" : "var(--ink)" }}>{item.day}</div>)}</div>
        </div>
        <div className="card card-pad-lg"><div className="section-title">Availability preferences</div><div className="col gap-12"><div className="row between"><span>Show me in urgent matching</span><Toggle on onChange={() => {}} /></div><div className="row between"><span>Accept half-day roles</span><Toggle on onChange={() => {}} /></div><div className="row between"><span>Travel up to 15 miles</span><Toggle on={false} onChange={() => {}} /></div></div></div>
      </div>
    </div>
  );
}

function BillingPage() {
  return (
    <div className="app-page">
      <PageHead title="Billing & plan" subtitle="Manage subscription, invoices, and account spend." actions={<Btn variant="secondary" icon="download">Export invoices</Btn>} />
      <div className="two-col">
        <div className="card card-pad-lg">
          <Tag>Pro plan</Tag>
          <div className="h-serif" style={{ fontSize: 36, marginTop: 12 }}>£99 / month</div>
          <div className="muted">Unlimited job posts, compliance tools, messaging, and AI matching.</div>
          <div className="progress" style={{ marginTop: 18 }}><div className="progress-fill" style={{ width: "58%" }} /></div>
          <div className="row gap-8 wrap" style={{ marginTop: 18 }}><Btn>Update payment method</Btn><Btn variant="secondary">Change plan</Btn></div>
        </div>
        <div className="card card-pad-lg">
          <div className="section-title">Recent invoices</div>
          {[["INV-2041", "Mar 2026", "£99"], ["INV-1978", "Feb 2026", "£99"], ["INV-1922", "Jan 2026", "£99"]].map(([id, month, amount]) => <div key={id} className="row between" style={{ padding: "12px 0", borderBottom: "0.5px solid var(--border)" }}><div><div className="fw-5">{id}</div><div className="xs muted">{month}</div></div><div className="row gap-8"><span>{amount}</span><Btn variant="ghost" size="sm" icon="download">PDF</Btn></div></div>)}
        </div>
      </div>
    </div>
  );
}

function AdminDashboard() {
  return (
    <div className="app-page">
      <PageHead title="Admin console" subtitle="Compliance, reviews, and marketplace quality at a glance." actions={<><Btn variant="secondary">Export report</Btn><Btn>Review queue</Btn></>} />
      <div className="grid-4" style={{ marginBottom: 28 }}>
        <Stat value="142" label="Pending reviews" delta="18 urgent" />
        <Stat value="8,412" label="Active teachers" delta="+96 this week" />
        <Stat value="2,138" label="Partner schools" delta="+12 this week" />
        <Stat value="94%" label="Roles filled within 2h" delta="Healthy" />
      </div>
      <div className="two-col">
        <div className="card card-pad-lg"><div className="section-title">Compliance queue</div>{[["Sarah Johnson", "Right to Work review"], ["Amina Hassan", "QTS verification"], ["Northfield Academy", "School onboarding"]].map(([name, task]) => <div key={name} className="row between" style={{ padding: "12px 0", borderBottom: "0.5px solid var(--border)" }}><div><div className="fw-5">{name}</div><div className="xs muted">{task}</div></div><Btn size="sm">Open</Btn></div>)}</div>
        <div className="card card-pad-lg"><div className="section-title">Trust metrics</div>{[["DBS verified", "99.2%"], ["Teacher response within 10m", "81%"], ["Disputes this month", "0.7%"], ["Average rating", "4.9"]].map(([label, value]) => <div key={label} className="row between" style={{ padding: "10px 0", borderBottom: "0.5px solid var(--border)" }}><span>{label}</span><span className="fw-6">{value}</span></div>)}</div>
      </div>
    </div>
  );
}

function AppChrome({ state, setState, children, go }) {
  const navItems = state.role === "institution"
    ? [{ id: "dashboard", label: "Dashboard", icon: "home" }, { id: "find-teachers", label: "Teachers", icon: "search" }, { id: "applications", label: "Applications", icon: "users" }, { id: "messaging", label: "Messages", icon: "message" }, { id: "billing", label: "Billing", icon: "file" }]
    : state.role === "teacher"
      ? [{ id: "dashboard", label: "Dashboard", icon: "home" }, { id: "find-jobs", label: "Jobs", icon: "search" }, { id: "calendar", label: "Calendar", icon: "calendar" }, { id: "messaging", label: "Messages", icon: "message" }, { id: "teacher-profile", label: "Profile", icon: "user" }]
      : [{ id: "admin", label: "Console", icon: "shield" }, { id: "messaging", label: "Messages", icon: "message" }];
  const userName = state.role === "institution" ? "Greenfield Primary" : state.role === "teacher" ? "Sarah Johnson" : "Admin Team";
  const userSub = state.role === "institution" ? "School account" : state.role === "teacher" ? "Supply teacher" : "Operations";
  return (
    <div className="proto-shell">
      <div className="proto-chrome">
        <div className="row gap-10"><Logo size={18} onClick={() => go("dashboard")} /><span className="pill">Prototype</span></div>
        <div className="proto-role-select">{[{ v: "institution", label: "School", icon: "building" }, { v: "teacher", label: "Teacher", icon: "user" }, { v: "admin", label: "Admin", icon: "shield" }].map((item) => <button key={item.v} className={`proto-role-btn ${state.role === item.v ? "active" : ""}`} onClick={() => setState((current) => ({ ...current, role: item.v, page: item.v === "admin" ? "admin" : "dashboard" }))}><span className="row gap-6"><Icon name={item.icon} size={12} /> {item.label}</span></button>)}</div>
        <div className="proto-crumb">{state.role === "institution" ? "School view" : state.role === "teacher" ? "Teacher view" : "Admin view"}</div>
        <Btn variant="ghost" size="sm" onClick={() => setState((current) => ({ ...current, auth: "landing" }))}>View landing</Btn>
      </div>
      <div className="app-nav">
        <Logo size={17} onClick={() => go("dashboard")} />
        <div className="app-nav-links">{navItems.map((item) => <div key={item.id} className={`app-nav-link ${state.page === item.id ? "active" : ""}`} onClick={() => go(item.id)}><span className="row gap-6"><Icon name={item.icon} size={13} /> {item.label}</span></div>)}</div>
        <div className="app-nav-right">
          <div className="row gap-6" style={{ background: "var(--chalk)", borderRadius: 8, padding: "6px 12px" }}><Icon name="search" size={13} /><input placeholder={state.role === "teacher" ? "Search jobs..." : "Search teachers..."} style={{ border: "none", outline: "none", background: "transparent", width: 140 }} /></div>
          <div className="notif-btn" onClick={() => go("messaging")}><Icon name="bell" size={16} /><div className="notif-dot" /></div>
          <div className="notif-btn"><Icon name="help" size={16} /></div>
          <div className="row gap-8"><Avatar name={userName} size="sm" /><div><div className="sm fw-6">{userName}</div><div className="xs muted">{userSub}</div></div></div>
        </div>
      </div>
      {children}
    </div>
  );
}

function TweaksPanel({ state, setState, tweaks, setTweaks }) {
  return (
    <div className="tweaks-panel">
      <div className="row between" style={{ marginBottom: 10 }}><div className="h-serif" style={{ fontSize: 18 }}>Tweaks</div><Btn variant="ghost" size="sm" icon="x" onClick={() => setState((current) => ({ ...current, tweaksOpen: false }))} /></div>
      <div className="col gap-12">
        <div><div className="xs muted" style={{ marginBottom: 6 }}>Jump to flow</div><select className="select" value={state.auth === "signed-in" ? `app:${state.page}` : `auth:${state.auth}`} onChange={(e) => { const [kind, value] = e.target.value.split(":"); setState((current) => kind === "auth" ? { ...current, auth: value } : { ...current, auth: "signed-in", page: value }); }}><optgroup label="Auth"><option value="auth:landing">Landing page</option><option value="auth:login">Login</option><option value="auth:onboarding">Onboarding</option></optgroup><optgroup label="App"><option value="app:dashboard">Dashboard</option><option value="app:post-job">Post a job</option><option value="app:applications">Applications</option><option value="app:find-teachers">Find teachers</option><option value="app:find-jobs">Find jobs</option><option value="app:job-detail">Job detail</option><option value="app:teacher-profile">Teacher profile</option><option value="app:messaging">Messages</option><option value="app:calendar">Calendar</option><option value="app:billing">Billing</option><option value="app:admin">Admin</option></optgroup></select></div>
        <div className="row between"><span className="sm">Urgent banner</span><Toggle on={tweaks.urgentBanner} onChange={(value) => setTweaks((current) => ({ ...current, urgentBanner: value }))} /></div>
        <div><div className="xs muted" style={{ marginBottom: 6 }}>Accent color</div><div className="row gap-6">{["#008CC4", "#16A34A", "#7C3AED", "#E11D48"].map((color) => <button key={color} type="button" onClick={() => setTweaks((current) => ({ ...current, accent: color }))} style={{ width: 28, height: 28, borderRadius: 6, border: tweaks.accent === color ? "2px solid var(--ink)" : "2px solid transparent", background: color, cursor: "pointer" }} />)}</div></div>
      </div>
    </div>
  );
}

export default function SupplyEDPrototype() {
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [state, setState] = useState(() => {
    if (typeof window === "undefined") return defaultState;
    try {
      const saved = JSON.parse(window.localStorage.getItem("supplyed_state") || "{}");
      return { ...defaultState, ...saved, toasts: [] };
    } catch {
      return defaultState;
    }
  });
  const [tweaks, setTweaks] = useState(() => {
    if (typeof window === "undefined") return { urgentBanner: true, accent: "#008CC4" };
    try {
      const savedTweaks = JSON.parse(window.localStorage.getItem("supplyed_tweaks") || "{}");
      return { urgentBanner: true, accent: "#008CC4", ...savedTweaks };
    } catch {
      return { urgentBanner: true, accent: "#008CC4" };
    }
  });

  useEffect(() => {
    if (!isClient) return;
    const { toasts, ...persisted } = state;
    window.localStorage.setItem("supplyed_state", JSON.stringify(persisted));
  }, [state, isClient]);

  useEffect(() => {
    if (!isClient) return;
    document.documentElement.style.setProperty("--se", tweaks.accent);
    window.localStorage.setItem("supplyed_tweaks", JSON.stringify(tweaks));
  }, [tweaks, isClient]);

  const toast = (entry) => {
    const id = Math.random().toString(36).slice(2);
    setState((current) => ({ ...current, toasts: [...current.toasts, { id, ...entry }] }));
    window.setTimeout(() => {
      setState((current) => ({ ...current, toasts: current.toasts.filter((item) => item.id !== id) }));
    }, 3200);
  };

  const go = (page, ctx = {}) => {
    setState((current) => ({ ...current, page, ctx: { ...current.ctx, ...ctx }, auth: current.auth === "signed-in" ? "signed-in" : current.auth }));
  };

  const routeProps = useMemo(() => ({ go, toast, state, setState, ctx: state.ctx, role: state.role, tweaks }), [state, tweaks]);

  let content = null;
  if (state.auth === "landing") content = <LandingPage onSignup={() => setState((current) => ({ ...current, auth: "onboarding", onboardingStep: 1 }))} onLogin={() => setState((current) => ({ ...current, auth: "login" }))} />;
  else if (state.auth === "login") content = <LoginPage role={state.role} setRole={(role) => setState((current) => ({ ...current, role }))} onLogin={() => setState((current) => ({ ...current, auth: "signed-in", page: current.role === "admin" ? "admin" : "dashboard" }))} onSwitchSignup={() => setState((current) => ({ ...current, auth: "onboarding", onboardingStep: 1 }))} />;
  else if (state.auth === "onboarding") content = <OnboardingPage step={state.onboardingStep} setStep={(step) => setState((current) => ({ ...current, onboardingStep: step }))} onFinish={() => { setState((current) => ({ ...current, auth: "signed-in", page: "dashboard" })); toast({ title: "Welcome to SupplyED", msg: "Documents submitted for review." }); }} />;
  else if (state.role === "institution") {
    if (state.page === "dashboard") content = <InstitutionDashboard {...routeProps} />;
    else if (state.page === "post-job") content = <PostJobPage {...routeProps} />;
    else if (state.page === "applications") content = <ApplicationsPage {...routeProps} />;
    else if (state.page === "find-teachers") content = <FindTeachersPage {...routeProps} />;
    else if (state.page === "teacher-profile") content = <TeacherProfilePage {...routeProps} />;
    else if (state.page === "messaging") content = <MessagingPage {...routeProps} />;
    else if (state.page === "billing") content = <BillingPage {...routeProps} />;
    else if (state.page === "job-detail") content = <JobDetailPage {...routeProps} />;
    else content = <InstitutionDashboard {...routeProps} />;
  } else if (state.role === "teacher") {
    if (state.page === "dashboard") content = <TeacherDashboard {...routeProps} />;
    else if (state.page === "find-jobs") content = <FindJobsPage {...routeProps} />;
    else if (state.page === "job-detail") content = <JobDetailPage {...routeProps} />;
    else if (state.page === "calendar") content = <CalendarPage {...routeProps} />;
    else if (state.page === "teacher-profile") content = <TeacherProfilePage {...routeProps} />;
    else if (state.page === "messaging") content = <MessagingPage {...routeProps} />;
    else content = <TeacherDashboard {...routeProps} />;
  } else {
    content = state.page === "messaging" ? <MessagingPage {...routeProps} /> : <AdminDashboard {...routeProps} />;
  }

  if (!isClient) return null;

  return (
    <>
      {state.auth === "signed-in" ? <AppChrome state={state} setState={setState} go={go}>{content}</AppChrome> : content}
      {state.tweaksOpen !== false ? <TweaksPanel state={state} setState={setState} tweaks={tweaks} setTweaks={setTweaks} /> : null}
      <ToastStack toasts={state.toasts} />
    </>
  );
}
