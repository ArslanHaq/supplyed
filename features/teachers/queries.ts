import "server-only";

import { seedTeachers } from "@/data/supplyed";
import { api } from "@/lib/server/api-client";

import { normalizeTeacherFilters } from "./schemas";
import type { Teacher, TeacherListFilters } from "./types";

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

export async function getTeacher(id: string): Promise<Teacher | null> {
  if (backendEnabled()) {
    return api.get<Teacher>(`/teachers/${id}`, {
      next: { tags: ["teachers", `teacher:${id}`] },
    });
  }

  return seedTeachers.find((teacher) => teacher.id === id) ?? null;
}
