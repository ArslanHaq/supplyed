"use client";
import { useDropdown } from "@/features/dropdowns/use-dropdown";
import { useMemo } from "react";
import type { TeachingCatalogue } from "./types";

// Compatibility export: invalidating this prefix refreshes every source collection.
export const teachingCatalogueKey = ["dropdown"] as const;
export function useTeachingCatalogue() {
  const subjects = useDropdown("subject"), skills = useDropdown("skill"), stages = useDropdown("keyStage");
  const data = useMemo<TeachingCatalogue | undefined>(() => {
    if (!subjects.data || !skills.data || !stages.data) return undefined;
    const subjectOptions = subjects.data.options.filter(option => option.isActive);
    const skillOptions = skills.data.options.filter(option => option.isActive);
    const stageOptions = stages.data.options.filter(option => option.isActive);
    const groups = [...new Set(subjectOptions.map(option => option.group || "Subjects"))];
    return {
      version: `db-${subjects.data.revision}.${skills.data.revision}.${stages.data.revision}`, title: subjects.data.label, description: "Choose subjects and related skills.",
      subjectOptions, skillOptions, stageOptions,
      categories: groups.map(name => ({ name, subjects: subjectOptions.filter(option => (option.group || "Subjects") === name).map(option => ({ name: option.value, aliases: option.aliases, skills: skillOptions.filter(skill => skill.subjectKeys.includes(option.key)).map(skill => skill.value) })) })),
      sharedSkills: skillOptions.filter(option => option.isShared).map(option => option.value), keyStages: stageOptions.map(option => option.value),
    };
  }, [subjects.data, skills.data, stages.data]);
  return { data, isError: subjects.isError || skills.isError || stages.isError, isLoading: subjects.isLoading || skills.isLoading || stages.isLoading, refetch: () => Promise.all([subjects.refetch(), skills.refetch(), stages.refetch()]) };
}
