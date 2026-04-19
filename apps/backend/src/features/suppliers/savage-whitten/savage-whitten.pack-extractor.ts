/**
 * Extract pack metadata from a single S&W product card.
 *
 * Card structure (see backend/src/features/suppliers/savage-whitten/listing.html):
 *   <p class="_product-price">
 *     €21.59 <span class="_product-size u-text-meta">(€1.80/Unit)</span>
 *   </p>
 *   <div class="o-grid">
 *     <p class="o-grid__item u-width-half _product-size">12 x 40's</p>
 *     ...
 *   </div>
 *
 * Format direction:  {packCount} x {unitSize}  (count first).
 */

import type { CheerioAPI } from 'cheerio';
import { type PackData, parseEuroAmount } from '../../../shared/services/pack-parser/index.js';

// cheerio doesn't re-export its Element type; use the callable return type.
type CheerioEl = ReturnType<CheerioAPI>;

// "(€1.80/Unit)" — the euro parser grabs the number; we only need to look
// inside the span that carries this suffix.
const UNIT_COST_PATTERN = /\(€\s*[\d.,]+\/Unit\)/i;

// "12 x 40's" — pack count first, unit size second.
const PACK_X_SIZE_PATTERN = /^(\d+)\s*x\s*(.+)$/i;

export function extractSWPackData($: CheerioAPI, card: CheerioEl): PackData {
  // --- Unit cost: the suffix span inside the price paragraph.
  let unitCostInclVat: number | null = null;
  card.find('p._product-price span._product-size').each((_, span) => {
    const text = $(span).text();
    if (UNIT_COST_PATTERN.test(text)) {
      unitCostInclVat = parseEuroAmount(text);
      return false; // break once found
    }
    return undefined;
  });

  // --- Pack count + unit size: first _product-size paragraph inside the
  //     product-info grid ("12 x 40's", "24 x 330ml").
  // Several elements carry the ._product-size class — pick the grid-item one
  // so we don't accidentally grab the price-suffix span.
  let packCount: number | null = null;
  let packUnitSize: string | null = null;

  const gridSize = card.find('div._product-info div.o-grid p.o-grid__item._product-size').first();

  if (gridSize.length > 0) {
    const raw = gridSize.text().trim();
    const match = PACK_X_SIZE_PATTERN.exec(raw);
    if (match) {
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed) && parsed > 0) packCount = parsed;
      packUnitSize = match[2].trim() || null;
    } else if (raw.length > 0) {
      // Not a "N x ..." pattern — keep the raw text as unit size (e.g. "Each").
      packUnitSize = raw;
    }
  }

  return { unitCostInclVat, packCount, packUnitSize };
}
