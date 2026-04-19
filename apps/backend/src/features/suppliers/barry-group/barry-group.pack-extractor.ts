/**
 * Extract pack metadata from a single Barry Group product card.
 *
 * Card structure (see backend/src/features/suppliers/barry-group/listing.html):
 *   <div class="ProdDesc">
 *     <a ...><b>7 UP 1.25L </b></a>
 *     <br>1.25l / 12             ← unit size + pack count, separated by " / "
 *   </div>
 *   <table>...
 *     <tr class="gridelebox">
 *       <td class="PDCell">UNIT COST INCL. VAT</td>
 *       <td class="PDDCell" align="right">€1.54</td>
 *     </tr>
 *   ...
 */

import type { CheerioAPI } from 'cheerio';
import { type PackData, parseEuroAmount } from '../../../shared/services/pack-parser/index.js';

// The element wrapper `$(card)` returns — cheerio's own Element type isn't
// re-exported from its public API, so use the callable return.
type CheerioEl = ReturnType<CheerioAPI>;

const UCIV_LABEL = 'UNIT COST INCL. VAT';

export function extractBarryPackData($: CheerioAPI, card: CheerioEl): PackData {
  // --- Unit cost: find the <tr> whose label cell matches "UNIT COST INCL. VAT",
  //     then read the adjacent value cell.
  let unitCostInclVat: number | null = null;
  card.find('tr.gridelebox').each((_, row) => {
    const label = $(row).find('td.PDCell').text().trim().toUpperCase();
    if (label === UCIV_LABEL) {
      const valueText = $(row).find('td.PDDCell').text();
      unitCostInclVat = parseEuroAmount(valueText);
      return false; // break the .each loop once found
    }
    return undefined;
  });

  // --- Pack count + unit size: subtitle line "<size> / <count>" under ProdDesc.
  // Extract the raw text after the product-name <a>, then split on "/".
  let packCount: number | null = null;
  let packUnitSize: string | null = null;

  const prodDesc = card.find('div.ProdDesc').first();
  if (prodDesc.length > 0) {
    // Clone the node so removing children doesn't mutate the real DOM.
    const clone = prodDesc.clone();
    clone.find('a').remove(); // strip the bold product name link
    const rawSubtitle = clone.text().replace(/\s+/g, ' ').trim();

    // Expected format: "<size> / <count>" (e.g. "1.25l / 12", "340g / 6").
    const slashIdx = rawSubtitle.lastIndexOf('/');
    if (slashIdx !== -1) {
      const left = rawSubtitle.slice(0, slashIdx).trim();
      const right = rawSubtitle.slice(slashIdx + 1).trim();
      packUnitSize = left.length > 0 ? left : null;

      const countMatch = right.match(/(\d+)/);
      if (countMatch) {
        const parsed = Number.parseInt(countMatch[1], 10);
        if (Number.isFinite(parsed) && parsed > 0) packCount = parsed;
      }
    }
  }

  return { unitCostInclVat, packCount, packUnitSize };
}
