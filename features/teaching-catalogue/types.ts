export type TeachingCatalogue = {
  subjectOptions?: import("@/features/dropdowns/types").DropdownOption[];
  skillOptions?: import("@/features/dropdowns/types").DropdownOption[];
  stageOptions?: import("@/features/dropdowns/types").DropdownOption[];
  version: string;
  title: string;
  description: string;
  categories: { name: string; subjects: { name: string; aliases: string[]; skills: string[] }[] }[];
  sharedSkills: string[];
  keyStages: string[];
};
