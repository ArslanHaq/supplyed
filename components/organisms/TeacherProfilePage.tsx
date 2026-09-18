import { useQuery } from "@tanstack/react-query";

import { fetchJson } from "@/lib/query/fetch-json";

import { SectionLoader } from "../molecules";

import { seedTeachers } from "@/data/supplyed";

import type { RouteProps } from "@/types/supplyed";

import { Avatar, Btn, Icon, MatchScore, Stars, Tag, VerifyBadge } from "../atoms";

type Instructor = {
  id: string;

  maxTravelDistance?: number | null;

  address?: string;

  postalCode?: string;

  countryCode?: string;

  latitude?: number | null;

  longitude?: number | null;

  fullName: string;

  bio?: string;

  city?: string;

  county?: string;

  subjects: string[];

  skills: string[];

  keyStages: string[];

  experience: number | null;

  hourlyRate: number | null;

  dailyRate: number | null;

  currency: string | null;

  dbsVerified: boolean;

  ratingAverage: number;

  ratingCount: number;
};

export function TeacherProfilePage({ ctx, go, role, state }: Pick<RouteProps, "ctx" | "go" | "role" | "state">) {
  const sample = seedTeachers.find((item) => item.id === (ctx.teacherId || (role === "teacher" ? "me" : "t-sarah")));

  const id = ctx.teacherId || "me";

  const query = useQuery({
    enabled: !sample,
    queryKey: ["instructor-profile", id],
    queryFn: () => fetchJson<Instructor>(`/api/instructors/${id}`),
  });

  const profile = query.data;

  if (!sample && query.isLoading)
    return (
      <div className="app-page">
        <SectionLoader rows={3} />
      </div>
    );

  if (!sample && !profile)
    return (
      <div className="app-page">
        <h1 className="section-title">Instructor profile unavailable</h1>
        <p>{query.error?.message || "Choose an instructor from your applications."}</p>
        <Btn onClick={() => go("applications")}>Back to applications</Btn>
      </div>
    );

  const teacher = sample || {
    id: profile!.id,
    name: profile!.fullName,
    role: profile!.subjects.join(", ") || "Instructor",

    city: [profile!.city, profile!.county].filter(Boolean).join(", ") || "Location not shared",

    dbs: profile!.dbsVerified,
    qts: false,
    subjects: profile!.subjects,
    keyStages: profile!.keyStages,

    rate: profile!.dailyRate,
    rating: profile!.ratingAverage,
    reviews: profile!.ratingCount,

    availability: "Not specified",
    tone: undefined,
    matchScore: 0,
  };

  const isIndividual = role === "individual";

  return (
    <div className="app-page">
      <div className="two-col">
        <div>
          <div className="card card-pad-lg mb-5">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar name={teacher.name} size="lg" tone={teacher.tone} />

              <div className="flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <h1 className="font-serif text-[32px]">{teacher.name}</h1>
                  {teacher.dbs ? <VerifyBadge /> : null}
                  {teacher.qts ? <Tag tone="ghost">QTS</Tag> : null}
                  {role === "teacher" && !ctx.teacherId && state.isFullyVerified ? (
                    <Tag tone="green">Verified</Tag>
                  ) : null}
                </div>

                <div className="text-[15px] text-muted">{teacher.role}</div>

                <div className="mt-3 flex flex-wrap gap-4">
                  <div className="flex items-center gap-1">
                    <Icon name="pin" size={12} />
                    {teacher.city}
                  </div>
                  <div className="flex items-center gap-1">
                    <Stars rating={teacher.rating} />
                    {teacher.rating} ({teacher.reviews})
                  </div>
                  <div className="flex items-center gap-1">
                    <Icon name="clock" size={12} />
                    Available {teacher.availability}
                  </div>
                </div>
              </div>

              {sample ? <MatchScore score={teacher.matchScore} /> : null}
            </div>
          </div>

          <div className="card card-pad-lg mb-5">
            <div className="section-title">About</div>
            <p className="leading-[1.7]">
              {profile
                ? profile.bio || "No biography provided."
                : "Enthusiastic and experienced supply teacher specialising in KS2 and KS3 Mathematics. Structured but engaging approach to lessons, always comes prepared. Experienced with SEN students."}
            </p>
          </div>

          <div className="card card-pad-lg">
            <div className="section-title">Subjects & stages</div>
            <div className="flex flex-wrap gap-2">
              {teacher.subjects.map((subject) => (
                <span className="pill" key={subject}>
                  {subject}
                </span>
              ))}
              {teacher.keyStages.map((stage) => (
                <span className="pill" key={stage}>
                  {stage}
                </span>
              ))}
              {profile?.skills.map((skill) => (
                <span className="pill" key={`skill-${skill}`}>
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="card card-pad-lg">
            <div className="font-serif text-[26px]">
              {profile
                ? profile.dailyRate != null
                  ? `${profile.currency || "GBP"} ${profile.dailyRate}`
                  : "Rate not specified"
                : `£${teacher.rate}`}
            </div>
            <div className="text-xs text-muted">{isIndividual ? "guide rate" : "per day"}</div>
            {profile ? (
              <div className="mt-4 space-y-2 text-sm">
                <p>
                  Hourly rate:{" "}
                  {profile.hourlyRate != null ? `${profile.currency || "GBP"} ${profile.hourlyRate}` : "Not specified"}
                </p>
                <p>Experience: {profile.experience != null ? `${profile.experience} years` : "Not specified"}</p>
                <p>
                  Travel distance:{" "}
                  {profile.maxTravelDistance ? `Up to ${profile.maxTravelDistance} miles` : "No travel limit set"}
                </p>
              </div>
            ) : null}
            <div className="section-title mt-5">Quick actions</div>
            <div className="flex flex-col gap-2">
              {role === "teacher" && !ctx.teacherId ? (
                <Btn variant="secondary" onClick={() => go("settings")}>
                  Edit profile
                </Btn>
              ) : null}
              <Btn onClick={() => go("messaging")}>Message</Btn>
              <Btn variant="secondary">{isIndividual ? "Request availability" : "Invite to job"}</Btn>
              <Btn variant="secondary">Download CV</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
