import type { Teacher } from "@/types/supplyed";

export type TeacherListFilters = {
  keyStage?: string;
  search?: string;
  subject?: string;
};

export type TeacherDirectoryFilters = {
  availableToday?: boolean;
  city?: string;
  dbsVerified?: boolean;
  keyStage?: string;
  limit?: number;
  maxDailyRate?: number;
  maxHourlyRate?: number;
  minExperience?: number;
  minRating?: number;
  page?: number;
  qtsQualified?: boolean;
  search?: string;
  skill?: string;
  subject?: string;
};

export type TeacherDirectoryItem = {
  availableToday: boolean;
  bio: string | null;
  city: string | null;
  county: string | null;
  currency: string | null;
  dailyRate: number | null;
  dbsVerified: boolean;
  experience: number | null;
  fullName: string;
  hourlyRate: number | null;
  id: string;
  imageUrl: string | null;
  keyStages: string[];
  memberSince: string | null;
  qtsQualified: boolean;
  ratingAverage: number;
  ratingCount: number;
  skills: string[];
  subjects: string[];
};

export type TeacherDirectoryPagination = {
  hasNextPage: boolean;
  limit: number;
  page: number;
  total: number;
  totalPages: number;
};

export type TeacherDirectoryPage = {
  instructors: TeacherDirectoryItem[];
  pagination: TeacherDirectoryPagination;
};

export type TeacherProfileUpdateInput = Partial<
  Pick<Teacher, "availability" | "city" | "keyStages" | "rate" | "subjects">
>;

export type { Teacher };
