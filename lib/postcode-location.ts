import type { DropdownOption } from "@/features/dropdowns/types";

export type PostcodeArea = {
  admin_county?: string | null;
  admin_district?: string | null;
  bua?: string | null;
  parish?: string | null;
  region?: string | null;
};

function normalizePlace(value: string) {
  return value.trim().toLowerCase().replace(/,\s*unparished area$/, "").replace(/\s+/g, " ");
}

// Submit the catalogue's value, which may differ from the displayed place name.
function matchPlace(candidates: Array<string | null | undefined>, options: DropdownOption[]) {
  for (const candidate of candidates) {
    if (!candidate?.trim()) continue;
    const match = options.find(option => option.isActive &&
      [option.value, option.label, ...option.aliases].some(value => normalizePlace(value) === normalizePlace(candidate)));
    if (match) return match.value;
  }
  return "";
}

export function resolvePostcodeLocation(area: PostcodeArea, cities: DropdownOption[], regions: DropdownOption[]) {
  return {
    countryCode: "GB",
    // Prefer a settlement over a council district. London boroughs share London
    // as their city; other broad regions must never be treated as towns.
    city: matchPlace([area.region === "London" ? "London" : null, area.bua, area.parish, area.admin_district], cities),
    county: matchPlace([area.admin_county, area.admin_district, area.region], regions),
  };
}
