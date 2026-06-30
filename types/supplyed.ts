import type { Dispatch, SetStateAction } from "react";

export type Tone = "" | "purple" | "amber" | "green";
export type ApplicationStage = "applied" | "shortlisted" | "interview" | "hired";
export type MessageAuthor = "me" | "them";
export type AppRole = "institution" | "teacher" | "admin";
export type AuthState = "landing" | "login" | "onboarding" | "signed-in";

export type AppPage =
  | "dashboard"
  | "post-job"
  | "applications"
  | "find-teachers"
  | "find-jobs"
  | "job-detail"
  | "teacher-profile"
  | "messaging"
  | "calendar"
  | "billing"
  | "admin";

export type Teacher = {
  id: string;
  name: string;
  role: string;
  city: string;
  rating: number;
  reviews: number;
  yearsExp: number;
  rate: number;
  dbs: boolean;
  qts: boolean;
  subjects: string[];
  keyStages: string[];
  matchScore: number;
  distance: string;
  availability: string;
  tone?: Tone;
};

export type Job = {
  id: string;
  title: string;
  school: string;
  city: string;
  date: string;
  rate: number;
  urgent: boolean;
  keyStage: string;
  subject: string;
  mode: "instant" | "brief";
  postedAt: string;
  applicants: number;
  matchScore: number;
  description?: string;
};

export type Application = {
  id: string;
  teacherId: string;
  jobId: string;
  stage: ApplicationStage;
  rate: number;
  coverLetter: string;
  appliedAt: string;
};

export type Message = {
  id: string;
  with: string;
  lastMsg: string;
  time: string;
  unread: number;
  tone?: Tone;
  thread: Array<{ from: MessageAuthor; text: string; time: string }>;
};

export type RouteContext = {
  jobId?: string;
  teacherId?: string;
};

export type ToastInput = {
  title: string;
  msg: string;
  icon?: string;
};

export type Toast = ToastInput & {
  id: string;
};

export type AppState = {
  role: AppRole;
  page: AppPage;
  auth: AuthState;
  onboardingStep: number;
  selectedJob: string;
  selectedTeacher: string;
  selectedMessage: string;
  ctx: RouteContext;
  toasts: Toast[];
  tweaksOpen?: boolean;
};

export type Tweaks = {
  urgentBanner: boolean;
  accent: string;
};

export type GoFn = (page: AppPage, ctx?: RouteContext) => void;
export type ToastFn = (entry: ToastInput) => void;
export type SetAppState = Dispatch<SetStateAction<AppState>>;
export type SetTweaks = Dispatch<SetStateAction<Tweaks>>;

export type RouteProps = {
  go: GoFn;
  toast: ToastFn;
  state: AppState;
  setState: SetAppState;
  ctx: RouteContext;
  role: AppRole;
  tweaks: Tweaks;
};
