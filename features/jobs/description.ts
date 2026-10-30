import { richTextToPlainText } from "@/features/applications/rich-text";

const GENERATED_DESCRIPTION_TEXT = "(?:Posting route:\\s*(?:Instant matching|Open brief)\\.|Marked urgent by the hiring account\\.|QTS requested\\.)";
const GENERATED_DESCRIPTION_BLOCK = new RegExp(`<p(?:\\s[^>]*)?>\\s*${GENERATED_DESCRIPTION_TEXT}\\s*</p>`, "gi");
const GENERATED_DESCRIPTION_LINE = new RegExp(`^${GENERATED_DESCRIPTION_TEXT}$`, "i");

/** Removes internal posting flags without flattening the school's rich-text markup. */
export function jobDescriptionForDisplay(value: string) {
  return value
    .replace(GENERATED_DESCRIPTION_BLOCK, "")
    .split(/\r?\n/)
    .filter((line) => !GENERATED_DESCRIPTION_LINE.test(richTextToPlainText(line).trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
