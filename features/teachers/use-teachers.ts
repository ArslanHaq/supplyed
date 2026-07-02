"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchJson } from "@/lib/query/fetch-json";
import { queryKeys } from "@/lib/query/keys";

import type { Teacher, TeacherListFilters } from "./types";

export function useTeachers(filters: TeacherListFilters = {}) {
  return useQuery({
    queryFn: () => fetchJson<Teacher[]>("/api/teachers", { query: filters }),
    queryKey: queryKeys.teachers.list(filters),
  });
}

export function useTeacher(id: string) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: () => fetchJson<Teacher>(`/api/teachers/${id}`),
    queryKey: queryKeys.teachers.detail(id),
  });
}
