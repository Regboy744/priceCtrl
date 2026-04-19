/**
 * Cookie helpers for HTTP-only suppliers.
 *
 * Extracted from the per-scraper duplicates so both scraping and ordering
 * use the same parsing rules.
 */

/**
 * Extract "name=value" pairs from a list of Set-Cookie header values.
 * Strips attributes (Path, Domain, HttpOnly, Expires, ...) — keeps only the
 * cookie name/value pair so it can be sent in a Cookie request header.
 */
export function extractCookieString(setCookies: string[]): string {
  return setCookies
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

/**
 * Merge two cookie strings. Newer cookies override older ones with the same
 * name, mirroring browser cookie-jar semantics for a single host.
 */
export function mergeCookies(existing: string, newer: string): string {
  const map = new Map<string, string>();
  for (const cookie of existing.split('; ').filter(Boolean)) {
    const [name] = cookie.split('=', 1);
    map.set(name, cookie);
  }
  for (const cookie of newer.split('; ').filter(Boolean)) {
    const [name] = cookie.split('=', 1);
    map.set(name, cookie);
  }
  return Array.from(map.values()).join('; ');
}
