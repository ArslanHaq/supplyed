import type { AppState, Application, Job, Message, Teacher, Tweaks } from "@/types/supplyed";

export const seedTeachers: Teacher[] = [
  { id: "t-sarah", name: "Sarah Johnson", role: "KS2 & KS3 Mathematics", city: "Salford, Greater Manchester", rating: 4.9, reviews: 47, yearsExp: 5, rate: 185, dbs: true, qts: true, subjects: ["Maths", "Science"], keyStages: ["KS2", "KS3"], matchScore: 94, distance: "2.1 mi", availability: "Today" },
  { id: "t-marcus", name: "Marcus Webb", role: "KS3 & KS4 Science", city: "Bolton", rating: 4.8, reviews: 32, yearsExp: 7, rate: 195, dbs: true, qts: true, subjects: ["Biology", "Chemistry"], keyStages: ["KS3", "KS4"], matchScore: 91, distance: "6.4 mi", availability: "Today", tone: "purple" },
  { id: "t-priya", name: "Priya Mehta", role: "Primary - KS1 & KS2", city: "Manchester", rating: 4.9, reviews: 58, yearsExp: 4, rate: 175, dbs: true, qts: true, subjects: ["All Primary"], keyStages: ["KS1", "KS2"], matchScore: 88, distance: "3.8 mi", availability: "Tomorrow", tone: "amber" },
  { id: "t-tom", name: "Tom Clarke", role: "KS3 English & Drama", city: "Stockport", rating: 4.7, reviews: 21, yearsExp: 3, rate: 170, dbs: true, qts: false, subjects: ["English", "Drama"], keyStages: ["KS3", "KS4"], matchScore: 83, distance: "8.1 mi", availability: "This week", tone: "green" },
  { id: "t-amina", name: "Amina Hassan", role: "KS4 & KS5 Mathematics", city: "Manchester", rating: 5, reviews: 19, yearsExp: 9, rate: 220, dbs: true, qts: true, subjects: ["Maths", "Further Maths"], keyStages: ["KS4", "KS5"], matchScore: 79, distance: "4.2 mi", availability: "Mon 29th" },
];

export const seedJobs: Job[] = [
  { id: "j-101", title: "Y6 Maths Cover - 1 day", school: "Greenfield Primary", city: "Salford", date: "Tomorrow, Wed 25 Mar", rate: 180, urgent: true, keyStage: "KS2", subject: "Maths", mode: "instant", postedAt: "2h ago", applicants: 4, matchScore: 94, description: "Covering Y6 Maths for the day. Lesson plans are ready on arrival. Class of 28 pupils, well behaved, parking on site." },
  { id: "j-102", title: "KS3 English - 3 days", school: "St Helens Academy", city: "Manchester", date: "Thu 26 Mar - Sat 28 Mar", rate: 165, urgent: false, keyStage: "KS3", subject: "English", mode: "instant", postedAt: "5h ago", applicants: 7, matchScore: 88 },
  { id: "j-103", title: "Long-term Science Cover", school: "Bridgewater High", city: "Stockport", date: "From Mon 30 Mar - 4 weeks", rate: 170, urgent: false, keyStage: "KS4", subject: "Science", mode: "brief", postedAt: "1d ago", applicants: 12, matchScore: 85 },
  { id: "j-104", title: "KS1 Reception Cover", school: "Oakwood Primary", city: "Bolton", date: "Fri 27 Mar", rate: 160, urgent: false, keyStage: "KS1", subject: "All Primary", mode: "instant", postedAt: "1d ago", applicants: 3, matchScore: 76 },
];

export const seedApplications: Application[] = [
  { id: "a-1", teacherId: "t-sarah", jobId: "j-101", stage: "shortlisted", rate: 180, coverLetter: "Available tomorrow, happy to arrive by 08:15. Five years of Y6 Maths cover experience.", appliedAt: "1h ago" },
  { id: "a-2", teacherId: "t-marcus", jobId: "j-101", stage: "applied", rate: 195, coverLetter: "Science specialist but happy to cover Maths. Grammar-school background.", appliedAt: "2h ago" },
  { id: "a-3", teacherId: "t-priya", jobId: "j-101", stage: "interview", rate: 175, coverLetter: "KS2 specialist with strong rapport with Y6 cohorts.", appliedAt: "3h ago" },
  { id: "a-4", teacherId: "t-tom", jobId: "j-101", stage: "applied", rate: 165, coverLetter: "English and drama specialist with full-day availability this week.", appliedAt: "5h ago" },
];

export const seedMessages: Message[] = [
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

export const defaultState: AppState = {
  role: "institution",
  page: "dashboard",
  auth: "landing",
  signupEmail: "",
  signupVerified: false,
  roleSelected: false,
  onboardingComplete: false,
  applicationStatus: "none",
  onboardingStep: 1,
  selectedJob: "j-101",
  selectedTeacher: "t-sarah",
  selectedMessage: "m-1",
  ctx: {},
  toasts: [],
  tweaksOpen: false,
};

export const defaultTweaks: Tweaks = {
  urgentBanner: true,
  accent: "#008CC4",
};
