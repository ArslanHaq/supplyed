import type { SchoolType } from "@/types/supplyed";

export type TeachingCatalogue = {
  subjectOptions?: import("@/features/dropdowns/types").DropdownOption[];
  skillOptions?: import("@/features/dropdowns/types").DropdownOption[];
  stageOptions?: import("@/features/dropdowns/types").DropdownOption[];
  version: string;
  title: string;
  description: string;
  schoolType: SchoolType | null;
  categories: { name: string; subjects: { name: string; aliases: string[]; skills: string[] }[] }[];
  sharedSkills: string[];
  keyStages: string[];
};

export type TeachingCatalogueScope = "all" | "school" | "schoolType";

export type TeachingCatalogueOptions = {
  enabled?: boolean;
  schoolType?: SchoolType | null;
  scope?: TeachingCatalogueScope;
};
