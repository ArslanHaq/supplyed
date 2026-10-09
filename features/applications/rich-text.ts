export const MAX_PROPOSAL_LENGTH = 2_000;

const HTML_TAG_PATTERN = /<\/?[a-z][^>]*>/i;

const namedEntities: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

function decodeHtmlEntities(value: string) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const normalized = entity.toLowerCase();
    if (normalized in namedEntities) return namedEntities[normalized];

    const numeric = normalized.startsWith("#x")
      ? Number.parseInt(normalized.slice(2), 16)
      : normalized.startsWith("#")
        ? Number.parseInt(normalized.slice(1), 10)
        : Number.NaN;

    return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : match;
  });
}

export function hasRichTextMarkup(value: string) {
  return HTML_TAG_PATTERN.test(value);
}

export function richTextToPlainText(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/\s*(?:p|div|li|ul|ol)\s*>/gi, "\n")
      .replace(/<[^>]*>/g, ""),
  )
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isEmptyRichText(value: string) {
  return richTextToPlainText(value).length === 0;
}
