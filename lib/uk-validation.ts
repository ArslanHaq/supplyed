import { City, State } from "country-state-city";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";

export const UK_COUNTRY_CODE = "GB";
export const UK_COUNTRY_NAME = "United Kingdom";
export type ValidationOptions = { required?: boolean };
export type UkValidationResult = { valid: boolean; value: string; error?: string };

function inputText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
function result(value: string, valid: boolean, error: string): UkValidationResult {
  return valid ? { valid, value } : { valid, value, error };
}
function optionalEmpty(value: unknown, options: ValidationOptions) {
  return !options.required && (value == null || (typeof value === "string" && !value.trim()));
}

/** Format/numbering-plan validation only: this does not establish ownership or reachability. */
export function validateUkPhone(value: unknown, options: ValidationOptions = {}): UkValidationResult {
  const raw = inputText(value);
  const error = "Enter a valid UK phone number.";
  if (optionalEmpty(value, options)) return { valid: true, value: "" };
  if (!raw || raw.length > 40 || !/^[+\d\s().-]+$/.test(raw)) return result(raw, false, error);
  const phone = parsePhoneNumberFromString(raw.replace(/^00/, "+"), { defaultCountry: "GB", extract: false });
  return phone?.country === "GB" && phone.isValid() && !phone.ext
    ? { valid: true, value: phone.number }
    : result(raw, false, error);
}

// Royal Mail outward/inward letter-position rules, including GIR 0AA. Crown
// dependencies are not part of the UK. A format match does not prove existence.
const postcodePattern = /^(?:GIR0AA|(?:[A-PR-UWYZ]\d\d?|[A-PR-UWYZ][A-HK-Y]\d\d?|[A-PR-UWYZ]\d[A-HJKPSTUW]|[A-PR-UWYZ][A-HK-Y]\d[ABEHMNPRVWXY])\d[ABD-HJLNP-UW-Z]{2})$/;
export function validateUkPostcode(value: unknown, options: ValidationOptions = {}): UkValidationResult {
  const raw = inputText(value);
  if (optionalEmpty(value, options)) return { valid: true, value: "" };
  const compact = raw.toUpperCase().replace(/\s+/g, "");
  const valid = raw.length <= 20 && postcodePattern.test(compact) && !/^(?:GY|JE|IM)/.test(compact);
  return result(valid ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : raw, valid, "Enter a valid UK postcode, for example SW1A 1AA.");
}

export function validateUkCountry(value: unknown, options: ValidationOptions = {}): UkValidationResult {
  const raw = inputText(value);
  if (optionalEmpty(value, options)) return { valid: true, value: "" };
  const valid = ["gb", "uk", "united kingdom", "united kingdom of great britain and northern ireland"].includes(raw.toLowerCase());
  return result(valid ? UK_COUNTRY_CODE : raw, valid, "Only United Kingdom addresses are supported.");
}

function locationKey(value: string) {
  return value.normalize("NFKC").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim().toLocaleLowerCase("en-GB");
}
const cityNames = [...new Set((City.getCitiesOfCountry("GB") ?? []).map(city => city.name))].sort((a, b) => a.localeCompare(b, "en-GB"));
const cityByName = new Map(cityNames.map(name => [locationKey(name), name]));
// These two overseas subdivisions are incorrectly grouped under GB in v3.2.1.
const regions = State.getStatesOfCountry("GB").filter(state => !state.isoCode.startsWith("SH-") && state.name !== "United Kingdom");
const regionNames = [...new Set([...regions.map(state => state.name), "Greater London", "Greater Manchester", "Merseyside", "South Yorkshire", "West Yorkshire", "West Midlands", "Tyne and Wear"])].sort((a, b) => a.localeCompare(b, "en-GB"));
const regionByName = new Map(regionNames.map(name => [locationKey(name), name]));
for (const name of regionNames) {
  const alias = name.replace(/^(?:City and County of |City of |Royal Borough of |London Borough of |Metropolitan Borough of )/, "").replace(/ (?:County Borough|Borough Council|District Council|City Council|district)$/, "");
  if (!regionByName.has(locationKey(alias))) regionByName.set(locationKey(alias), name);
}

export function getUkCities(): string[] { return [...cityNames]; }
export function getUkRegions(): string[] { return [...regionNames]; }

/** Dataset membership, not address verification; never infer a town from a district. */
export function validateUkCity(value: unknown, options: ValidationOptions = {}): UkValidationResult {
  const raw = inputText(value);
  if (optionalEmpty(value, options)) return { valid: true, value: "" };
  const canonical = cityByName.get(locationKey(raw));
  return result(canonical ?? raw, Boolean(canonical), "Select a valid UK city or town.");
}

export function validateUkRegion(value: unknown, options: ValidationOptions = {}): UkValidationResult {
  const raw = inputText(value);
  if (optionalEmpty(value, options)) return { valid: true, value: "" };
  const canonical = regionByName.get(locationKey(raw));
  return result(canonical ?? raw, Boolean(canonical), "Select a valid UK county or region.");
}
