"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";

import type { Teacher, TeacherDirectoryFilters, TeacherDirectoryPage, TeacherListFilters } from "./types";

export function useTeachers(filters: TeacherListFilters = {}) {
  return useQuery({
    queryFn: ({ signal }) => fetchJson<Teacher[]>("/api/teachers", { query: filters, signal }),
    queryKey: queryKeys.teachers.list(filters),
  });
}

export function useTeacherDirectory(filters: TeacherDirectoryFilters = {}) {
  return useQuery({
    queryFn: ({ signal }) => fetchJson<TeacherDirectoryPage>("/api/instructors/directory", { query: filters, signal }),
    queryKey: queryKeys.teachers.directory(filters),
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

export function useTeacher(id: string) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: ({ signal }) => fetchJson<Teacher>(`/api/teachers/${id}`, { signal }),
    queryKey: queryKeys.teachers.detail(id),
  });
}
