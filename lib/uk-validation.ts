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
  // Require an explicit UK prefix instead of guessing a country for bare digits.
  const compact = raw.replace(/[\s().-]/g, "");
  if (!/^(?:\+44|0044|0(?!0))\d+$/.test(compact)) return result(raw, false, error);
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

/** Shape checks only. Active city/region membership is owned by the dropdown API.
 * Preserve exact option.value: label changes and new administrator choices must round-trip. */
export function validateUkCity(value: unknown, options: ValidationOptions = {}): UkValidationResult {
  const raw = inputText(value);
  if (optionalEmpty(value, options)) return { valid: true, value: "" };
  return result(raw, Boolean(raw) && raw.length <= 100 && !/\p{Cc}/u.test(raw), "Select a UK city or town.");
}
export function validateUkRegion(value: unknown, options: ValidationOptions = {}): UkValidationResult {
  const raw = inputText(value);
  if (optionalEmpty(value, options)) return { valid: true, value: "" };
  return result(raw, Boolean(raw) && raw.length <= 100 && !/\p{Cc}/u.test(raw), "Select a UK county or region.");
}
