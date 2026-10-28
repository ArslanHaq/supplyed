import { parsePhoneNumberFromString, validatePhoneNumberLength } from "libphonenumber-js/max";
import { validateUkPhone } from "./uk-validation";

export function ukPhoneEdit(raw: string): string | undefined | false {
  if (!raw.trim()) return undefined;
  if (!/^[+\d\s().-]+$/.test(raw)) return false;
  let digits = raw.replace(/[\s().-]/g, "");
  if (["+", "+4", "+44"].includes(digits)) return undefined;
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (digits.startsWith("+") && !digits.startsWith("+44")) return false;
  if (digits.startsWith("+44")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!digits) return undefined;
  if (!/^[1235789]\d*$/.test(digits)) return false;
  const value = `+44${digits}`;
  if (validatePhoneNumberLength(value, "GB") === "TOO_LONG") return false;
  const phone = parsePhoneNumberFromString(value, { defaultCountry: "GB", extract: false });
  if (phone?.country && phone.country !== "GB") return false;
  if (digits.length >= 10 && !phone?.isValid()) return false;
  return value;
}

/** A pasted full number must already be UK: never reinterpret a foreign prefix. */
export function ukPhonePaste(raw: string): string | false {
  const phone = validateUkPhone(raw, { required: true });
  return phone.valid ? phone.value : false;
}
