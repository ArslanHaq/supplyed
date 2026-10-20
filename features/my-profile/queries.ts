import "server-only";

import { listApplicationsByJob, listMyApplications } from "@/features/applications/queries";
import { listMyBookings } from "@/features/bookings/queries";
import { getJob, listMyJobs } from "@/features/jobs/queries";
import { ApiError } from "@/lib/server/api-client";
import { getServerAuthContext } from "@/lib/server/auth-context";
import { backendEnabled } from "@/lib/server/backend-config";

import type { MyProfileReview, MyProfileReviews, ProfileApplication, ProfileApplications, ProfilePageQuery, ProfilePagination, ReviewDirection } from "./types";

async function requireProfileRole() {
  const auth = await getServerAuthContext();
  if (!auth) throw new ApiError("Sign in to view your profile.", 401);
  if (auth.role !== "teacher" && auth.role !== "institution") throw new ApiError("This profile is available to teachers and schools.", 403);
  if (!backendEnabled()) throw new ApiError("Connect your account service to load your profile history.", 503);
  return auth.role;
}

function requestBudget() {
  const deadline = Date.now() + 30_000;
  let requests = 0;
  return () => {
    if (Date.now() >= deadline || ++requests > 300) throw new ApiError("Your history could not be loaded completely. Please try again or open the relevant workspace page.", 503);
  };
}

/** Never return an apparently complete history when an upstream page is missing or repeats. */
async function collectPages<T extends { id: string }>(read: (page: number) => Promise<{ items: T[]; pagination: ProfilePagination }>, checkBudget: () => void): Promise<T[]> {
  const items = new Map<string, T>();
  for (let page = 1; ; page++) {
    checkBudget();
    const result = await read(page);
    const before = items.size;
    result.items.forEach(item => items.set(item.id, item));
    if (!result.pagination.hasNextPage) {
      if (items.size < result.pagination.total) throw new ApiError("Some history records could not be loaded. Please try again.", 502);
      return [...items.values()];
    }
    if (items.size === before) throw new ApiError("Your history returned a repeated page. Please try again.", 502);
  }
}

function paginate<T>(items: T[], { page, limit }: ProfilePageQuery) {
  const total = items.length;
  return { items: items.slice((page - 1) * limit, page * limit), pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total } };
}

function newestFirst(left: { createdAt?: string | null; id: string }, right: { createdAt?: string | null; id: string }) {
  const time = (value?: string | null) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
  return time(right.createdAt) - time(left.createdAt) || left.id.localeCompare(right.id);
}

export async function listMyProfileApplications(query: ProfilePageQuery): Promise<ProfileApplications> {
  const role = await requireProfileRole();
  if (role === "teacher") {
    const result = await listMyApplications(query);
    const jobs = new Map(await Promise.all([...new Set(result.applications.map(item => item.jobId))].map(async id => {
      try { return [id, await getJob(id)] as const; }
      catch (error) {
        if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return [id, null] as const;
        throw error;
      }
    })));
    return { ...result, applications: result.applications.map(item => ({ ...item, jobTitle: item.jobName?.trim() || jobs.get(item.jobId)?.title || null, schoolName: jobs.get(item.jobId)?.school ?? null, jobAvailable: Boolean(jobs.get(item.jobId)) })) };
  }

  const checkBudget = requestBudget();
  const jobs = await collectPages(async page => {
    const result = await listMyJobs({ page, limit: 100 });
    return { items: result.jobs, pagination: result.pagination };
  }, checkBudget);
  const applications: ProfileApplication[] = [];
  for (let offset = 0; offset < jobs.length; offset += 5) {
    const batch = await Promise.all(jobs.slice(offset, offset + 5).map(async job => {
      const records = await collectPages(async page => {
        const result = await listApplicationsByJob(job.id, { page, limit: 100 });
        return { items: result.applications, pagination: result.pagination };
      }, checkBudget);
      return records.map(item => ({ ...item, jobTitle: item.jobName?.trim() || job.title, schoolName: job.school, jobAvailable: true }));
    }));
    applications.push(...batch.flat());
  }
  const result = paginate(applications.sort(newestFirst), query);
  return { applications: result.items, pagination: result.pagination };
}

export async function listMyProfileReviews(query: ProfilePageQuery & { direction: ReviewDirection }): Promise<MyProfileReviews> {
  const role = await requireProfileRole();
  const bookings = await collectPages(async page => {
    const result = await listMyBookings({ page, limit: 100 });
    return { items: result.bookings, pagination: result.pagination };
  }, requestBudget());
  const ownType = role === "teacher" ? "INSTRUCTOR" : "INSTITUTION";
  const unique = new Map<string, MyProfileReview>();
  for (const booking of bookings) {
    const party = role === "teacher" ? booking.institution : booking.instructor;
    for (const review of booking.reviews) {
      unique.set(review.id, {
        ...review,
        bookingId: booking.id,
        direction: review.reviewerType === ownType ? "given" : "received",
        jobId: booking.job.id,
        jobTitle: booking.job.title,
        partyId: party.id,
        partyName: party.fullName || party.name || (role === "teacher" ? "School" : "Teacher"),
      });
    }
  }
  const reviews = [...unique.values()].sort(newestFirst);
  const received = reviews.filter(review => review.direction === "received");
  const result = paginate(reviews.filter(review => review.direction === query.direction), query);
  return {
    reviews: result.items, pagination: result.pagination,
    receivedTotal: received.length, givenTotal: reviews.length - received.length,
    averageReceived: received.length ? received.reduce((sum, item) => sum + item.rating, 0) / received.length : null,
  };
}
