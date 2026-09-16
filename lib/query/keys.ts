export const queryKeys = {
  applications: {
    all: ["applications"] as const,
    byJob: (jobId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.applications.all, "job", jobId, filters ?? {}] as const,
  },
  auth: {
    all: ["auth"] as const,
    me: () => [...queryKeys.auth.all, "me"] as const,
  },
  documentRequirements: {
    all: ["document-requirements"] as const,
    application: () => [...queryKeys.documentRequirements.all, "application"] as const,
  },
  jobs: {
    all: ["jobs"] as const,
    detail: (id: string) => [...queryKeys.jobs.all, "detail", id] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.jobs.all, "list", filters ?? {}] as const,
    mine: (filters?: Record<string, unknown>) => [...queryKeys.jobs.all, "mine", filters ?? {}] as const,
  },
  matching: {
    all: ["matching"] as const,
    applications: (jobId: string, query?: Record<string, unknown>) => [...queryKeys.matching.all, "applications", jobId, query ?? {}] as const,
    instructors: (jobId: string, query?: Record<string, unknown>) => [...queryKeys.matching.all, "instructors", jobId, query ?? {}] as const,
    recommendedJobs: (query?: Record<string, unknown>) => [...queryKeys.matching.all, "recommended-jobs", query ?? {}] as const,
    score: (jobId: string) => [...queryKeys.matching.all, "score", jobId] as const,
  },
  onboarding: {
    all: ["onboarding"] as const,
    current: () => [...queryKeys.onboarding.all, "current"] as const,
    documentRequirements: (role: string) => [...queryKeys.onboarding.all, "document-requirements", role] as const,
  },
  settings: {
    all: ["settings"] as const,
    profile: () => [...queryKeys.settings.all, "profile"] as const,
  },
  teachers: {
    all: ["teachers"] as const,
    detail: (id: string) => [...queryKeys.teachers.all, "detail", id] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.teachers.all, "list", filters ?? {}] as const,
  },
};
