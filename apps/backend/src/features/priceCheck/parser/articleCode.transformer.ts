/**
 * Article Code Transformer
 *
 * Transforms article codes from XLS format to database format.
 *
 * XLS Format: "01483944\0" (leading zero, backslash, suffix)
 * DB Format:  "1483944 000" (no leading zero, space, 3-digit padded suffix)
 *
 * Examples:
 *   "01483944\0"   → "1483944 000"
 *   "01483945\14"  → "1483945 014"
 *   "01174788\4"   → "1174788 004"
 *   "01013407\19"  → "1013407 019"
 */

/**
 * Transform article code from XLS format to database format
 *
 * @param raw - Raw article code from XLS (e.g., "01483944\0")
 * @returns Transformed article code (e.g., "1483944 000") or null if invalid
 *
 * @example
 * transformArticleCode("01483944\\0")   // "1483944 000"
 * transformArticleCode("01174788\\4")   // "1174788 004"
 * transformArticleCode("invalid")       // null
 */
export function transformArticleCode(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') {
    return null;
  }

  // Trim and normalize
  const trimmed = raw.trim();

  // Match pattern: optional leading zeros, digits, backslash, digits
  // The backslash might be escaped or literal depending on how Excel exports it
  const match = trimmed.match(/^0*(\d+)[\\\/](\d+)$/);

  if (!match) {
    return null;
  }

  const [, mainPart, suffix] = match;

  // Validate main part has reasonable length (article codes are typically 7 digits)
  if (mainPart.length < 5 || mainPart.length > 10) {
    return null;
  }

  // Pad suffix to 3 digits with leading zeros
  const paddedSuffix = suffix.padStart(3, '0');

  return `${mainPart} ${paddedSuffix}`;
}

/**
 * Check if a raw value looks like an article code (has backslash pattern)
 * Used to detect data rows vs header/category rows
 *
 * @param value - Cell value to check
 * @returns true if it matches the article code pattern
 */
export function isArticleCodePattern(value: unknown): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  // Must contain backslash or forward slash followed by digits
  return /\d+[\\\/]\d+/.test(value.trim());
}

/**
 * Batch transform multiple article codes
 *
 * @param codes - Array of raw article codes
 * @returns Array of { raw, transformed, valid } objects
 */
export function transformArticleCodes(
  codes: (string | null | undefined)[]
): Array<{ raw: string | null; transformed: string | null; valid: boolean }> {
  return codes.map((raw) => {
    const transformed = transformArticleCode(raw);
    return {
      raw: raw ?? null,
      transformed,
      valid: transformed !== null,
    };
  });
}
