import type { Teacher } from "@/types/supplyed";

export type TeacherListFilters = {
  keyStage?: string;
  search?: string;
  subject?: string;
};

export type TeacherProfileUpdateInput = Partial<
  Pick<Teacher, "availability" | "city" | "keyStages" | "rate" | "subjects">
>;

export type { Teacher };
