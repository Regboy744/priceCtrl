/**
 * Euro-amount parser shared by the HTML-scraping suppliers (Barry, S&W,
 * O'Reillys). Musgrave sends typed numbers in its JSON API and doesn't use
 * this.
 *
 * Handles the realistic variants seen in the four listing fixtures:
 *   "€1.54", "€14.99", "(€1.65/Unit)", " €0.77 ", "€1,234.56"
 */

const EURO_NUMBER_RE = /€\s*([\d]+(?:[.,]\d+)?)/;

/**
 * Extract a euro amount from arbitrary text. Returns null when no match or
 * the captured number is not finite. Never throws — scrapers call this on
 * best-effort text.
 */
export function parseEuroAmount(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = EURO_NUMBER_RE.exec(text);
  if (!match) return null;
  // Normalize comma decimal separator ("1,54") to dot.
  const normalized = match[1].replace(',', '.');
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}
