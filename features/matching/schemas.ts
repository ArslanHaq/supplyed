import { normalizeApplication } from "@/features/applications/schemas";
import { normalizeBackendJob } from "@/features/jobs/schemas";

import type {
  BackendRecommendedJobsPage,
  MatchListQuery,
  MatchResult,
  RankedApplicationsPage,
  RecommendedInstructorsPage,
  RecommendedJobsPage,
} from "./types";

export function normalizeMatchQuery(query: MatchListQuery = {}): Required<MatchListQuery> {
  return {
    limit: boundedInteger(query.limit, 20, 1, 100),
    minScore: boundedInteger(query.minScore, 0, 0, 100),
    page: boundedInteger(query.page, 1, 1, Number.MAX_SAFE_INTEGER),
  };
}

export function normalizeMatch(match: MatchResult): MatchResult {
  return {
    distanceMiles: finiteNumber(match.distanceMiles),
    factors: (match.factors ?? []).map((factor) => ({
      ...factor,
      applicable: Boolean(factor.applicable),
      value: clamp(Number(factor.value) || 0, 0, 1),
      weight: Math.max(0, Number(factor.weight) || 0),
    })),
    flags: {
      distanceKnown: Boolean(match.flags?.distanceKnown),
      outsideTravelRadius: Boolean(match.flags?.outsideTravelRadius),
      scheduleConflict: Boolean(match.flags?.scheduleConflict),
    },
    score: clamp(Math.round(Number(match.score) || 0), 0, 100),
  };
}

export function normalizeRankedApplications(payload: RankedApplicationsPage): RankedApplicationsPage {
  return {
    ...payload,
    applications: (payload.applications ?? []).map((item) => ({
      ...item,
      application: normalizeApplication(item.application),
      instructor: normalizeInstructor(item.instructor),
      match: normalizeMatch(item.match),
    })),
  };
}

export function normalizeRecommendedInstructors(payload: RecommendedInstructorsPage): RecommendedInstructorsPage {
  return {
    ...payload,
    instructors: (payload.instructors ?? []).map((item) => ({ ...item, instructor: normalizeInstructor(item.instructor), match: normalizeMatch(item.match) })),
  };
}

export function normalizeRecommendedJobs(payload: BackendRecommendedJobsPage): RecommendedJobsPage {
  return {
    ...payload,
    jobs: (payload.jobs ?? []).map((item) => ({ job: normalizeBackendJob(item.job), match: normalizeMatch(item.match) })),
  };
}

function normalizeInstructor<T extends { keyStages: string[]; skills: string[]; subjects: string[] }>(instructor: T): T {
  return {
    ...instructor,
    keyStages: unique(instructor.keyStages),
    skills: unique(instructor.skills),
    subjects: unique(instructor.subjects),
  };
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  return Number.isInteger(number) ? clamp(number, min, max) : fallback;
}

function finiteNumber(value: unknown) {
  const number = Number(value);
  return value === null || value === undefined || !Number.isFinite(number) ? null : number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function unique(value: string[] = []) {
  return Array.from(new Set(value.map((item) => item.trim()).filter(Boolean)));
}
