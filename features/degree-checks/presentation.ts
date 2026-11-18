import type { VerifiedDegree } from "./types";

/** e.g. "BSc Hons Mathematics, 2:1 – University of Leeds (2015)"; fields the university withheld are left out. */
export function describeDegree(degree: VerifiedDegree) {
  const award = [[degree.qualificationType, degree.courseName].filter(Boolean).join(" "), degree.classification]
    .filter(Boolean)
    .join(", ");

  return `${award ? `${award} – ` : ""}${degree.institutionName}${degree.yearOfAward ? ` (${degree.yearOfAward})` : ""}`;
}
