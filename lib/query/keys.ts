export const queryKeys = {
  applications: {
    all: ["applications"] as const,
    byJob: (jobId: string, filters?: Record<string, unknown>) =>
      [...queryKeys.applications.all, "job", jobId, filters ?? {}] as const,
    mine: (filters?: Record<string, unknown>) =>
      [...queryKeys.applications.all, "mine", filters ?? {}] as const,
  },
  auth: {
    all: ["auth"] as const,
    me: () => [...queryKeys.auth.all, "me"] as const,
  },
  jobs: {
    all: ["jobs"] as const,
    detail: (id: string) => [...queryKeys.jobs.all, "detail", id] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.jobs.all, "list", filters ?? {}] as const,
    mine: (filters?: Record<string, unknown>) => [...queryKeys.jobs.all, "mine", filters ?? {}] as const,
  },
  onboarding: {
    all: ["onboarding"] as const,
    current: () => [...queryKeys.onboarding.all, "current"] as const,
  },
  teachers: {
    all: ["teachers"] as const,
    detail: (id: string) => [...queryKeys.teachers.all, "detail", id] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.teachers.all, "list", filters ?? {}] as const,
  },
};
