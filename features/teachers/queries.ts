import "server-only";

import { seedTeachers } from "@/data/supplyed";
import { api } from "@/lib/server/api-client";

import { normalizeTeacherDirectoryFilters, normalizeTeacherDirectoryPage, normalizeTeacherFilters } from "./schemas";
import type {
  Teacher,
  TeacherDirectoryFilters,
  TeacherDirectoryItem,
  TeacherDirectoryPage,
  TeacherListFilters,
} from "./types";

function backendEnabled() {
  return Boolean(process.env.API_BASE_URL);
}

export async function listTeachers(filters: TeacherListFilters = {}): Promise<Teacher[]> {
  const normalized = normalizeTeacherFilters(filters);

  if (backendEnabled()) {
    return api.get<Teacher[]>("/teachers", {
      next: { tags: ["teachers"] },
      query: normalized,
    });
  }

  return seedTeachers.filter((teacher) => {
    const matchesSearch = normalized.search
      ? teacher.name.toLowerCase().includes(normalized.search.toLowerCase()) ||
        teacher.role.toLowerCase().includes(normalized.search.toLowerCase())
      : true;
    const matchesSubject = normalized.subject ? teacher.subjects.includes(normalized.subject) : true;
    const matchesKeyStage = normalized.keyStage ? teacher.keyStages.includes(normalized.keyStage) : true;

    return matchesSearch && matchesSubject && matchesKeyStage;
  });
}

/** Institution-only directory of active instructor profiles. */
export async function listTeacherDirectory(filters: TeacherDirectoryFilters = {}): Promise<TeacherDirectoryPage> {
  const normalized = normalizeTeacherDirectoryFilters(filters);

  if (backendEnabled()) {
    const result = await api.get<unknown>("/instructors/directory", {
      cache: "no-store",
      query: normalized,
    });
    return normalizeTeacherDirectoryPage(result, normalized);
  }

  const directory = seedTeachers.map(toDirectoryItem).filter((teacher) => matchesDirectoryFilters(teacher, normalized));
  const page = normalized.page ?? 1;
  const limit = normalized.limit ?? 20;
  const start = (page - 1) * limit;
  const totalPages = Math.ceil(directory.length / limit);

  return {
    instructors: directory.slice(start, start + limit),
    pagination: {
      hasNextPage: page < totalPages,
      limit,
      page,
      total: directory.length,
      totalPages,
    },
  };
}

export async function getTeacher(id: string): Promise<Teacher | null> {
  if (backendEnabled()) {
    return api.get<Teacher>(`/teachers/${id}`, {
      next: { tags: ["teachers", `teacher:${id}`] },
    });
  }

  return seedTeachers.find((teacher) => teacher.id === id) ?? null;
}

function toDirectoryItem(teacher: Teacher): TeacherDirectoryItem {
  return {
    availableToday: teacher.availability.toLowerCase().includes("today"),
    bio: teacher.role,
    city: teacher.city,
    county: null,
    currency: "GBP",
    dailyRate: teacher.rate,
    dbsVerified: teacher.dbs,
    experience: teacher.yearsExp,
    fullName: teacher.name,
    hourlyRate: null,
    id: teacher.id,
    imageUrl: null,
    keyStages: teacher.keyStages,
    memberSince: null,
    qtsQualified: teacher.qts,
    ratingAverage: teacher.rating,
    ratingCount: teacher.reviews,
    skills: [teacher.role],
    subjects: teacher.subjects,
  };
}

function matchesDirectoryFilters(teacher: TeacherDirectoryItem, filters: TeacherDirectoryFilters) {
  const search = filters.search?.toLowerCase();
  const matchesSearch = !search || [teacher.fullName, teacher.city, teacher.county].some((value) => value?.toLowerCase().includes(search));
  const exact = (values: string[], expected?: string) => !expected || values.some((value) => value.toLowerCase() === expected.toLowerCase());

  return matchesSearch &&
    exact(teacher.subjects, filters.subject) &&
    exact(teacher.keyStages, filters.keyStage) &&
    exact(teacher.skills, filters.skill) &&
    (!filters.city || teacher.city?.toLowerCase() === filters.city.toLowerCase()) &&
    (filters.dbsVerified === undefined || teacher.dbsVerified === filters.dbsVerified) &&
    (filters.qtsQualified === undefined || teacher.qtsQualified === filters.qtsQualified) &&
    (filters.availableToday === undefined || teacher.availableToday === filters.availableToday) &&
    (filters.minExperience === undefined || (teacher.experience ?? -1) >= filters.minExperience) &&
    (filters.maxHourlyRate === undefined || (teacher.hourlyRate !== null && teacher.hourlyRate <= filters.maxHourlyRate)) &&
    (filters.maxDailyRate === undefined || (teacher.dailyRate !== null && teacher.dailyRate <= filters.maxDailyRate)) &&
    (filters.minRating === undefined || teacher.ratingAverage >= filters.minRating);
}
