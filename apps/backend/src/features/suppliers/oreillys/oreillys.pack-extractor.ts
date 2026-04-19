/**
 * Extract pack metadata from a single O'Reillys product card.
 *
 * Card structure (see backend/src/features/suppliers/oreillys/listing.html):
 *   <div class="PromoPrice">€10.99</div>
 *   <div class="PUnitCost">(€1.57/Unit)</div>
 *   ...
 *   <td class="ProdDetails">60gm x 12&nbsp;</td>   ← unit size x pack count
 *
 * Format direction:  {unitSize} x {packCount}  (size first — opposite of S&W).
 *
 * Note: not every O'Reillys card has the pack line (shelf items etc), so the
 * extractor defensively tolerates missing fields — this is the only supplier
 * where pack_count occasionally can't be read directly.
 */

import type { CheerioAPI } from 'cheerio';
import { type PackData, parseEuroAmount } from '../../../shared/services/pack-parser/index.js';

type CheerioEl = ReturnType<CheerioAPI>;

// "(€1.57/Unit)"
const UNIT_COST_PATTERN = /\(€\s*[\d.,]+\/Unit\)/i;

// "60gm x 12" — unit size first, pack count second. Allow trailing whitespace
// or HTML entities like &nbsp; which cheerio decodes.
const SIZE_X_PACK_PATTERN = /^([\w.,\s]+?)\s*x\s*(\d+)\s*$/i;

export function extractOreillysPackData($: CheerioAPI, card: CheerioEl): PackData {
  // --- Unit cost: dedicated <div class="PUnitCost">.
  let unitCostInclVat: number | null = null;
  const unitCostEl = card.find('div.PUnitCost').first();
  if (unitCostEl.length > 0) {
    const text = unitCostEl.text();
    if (UNIT_COST_PATTERN.test(text)) {
      unitCostInclVat = parseEuroAmount(text);
    }
  }

  // --- Pack count + unit size: find a ProdDetails cell whose text matches
  //     "<size> x <count>".
  let packCount: number | null = null;
  let packUnitSize: string | null = null;

  card.find('td.ProdDetails').each((_, td) => {
    const raw = $(td)
      .text()
      .replace(/\u00a0/g, ' ')
      .trim(); // strip &nbsp;
    const match = SIZE_X_PACK_PATTERN.exec(raw);
    if (match) {
      const parsed = Number.parseInt(match[2], 10);
      if (Number.isFinite(parsed) && parsed > 0) packCount = parsed;
      packUnitSize = match[1].trim() || null;
      return false; // break
    }
    return undefined;
  });

  return { unitCostInclVat, packCount, packUnitSize };
}
