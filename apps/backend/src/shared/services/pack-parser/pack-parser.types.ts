/**
 * Per-supplier_product pack metadata, as extracted from a listing.
 *
 * Every supplier publishes per-unit cost on its listings (UCIV on Musgrave,
 * "UNIT COST INCL. VAT" on Barry, "(€X/Unit)" on S&W + O'Reillys). This shape
 * is the cross-supplier contract the scrapers hand to the persistence layer
 * via `ScrapedProduct.metadata`.
 *
 * All fields nullable — any value the extractor can't find stays null, and
 * the comparison logic falls back to case-price ranking while flagging
 * `requires_user_pick`.
 */
export interface PackData {
  /** Supplier-published per-consumer-unit cost, VAT incl. EUR. */
  unitCostInclVat: number | null;

  /** Consumer units per case/pack (12, 24, 8...). */
  packCount: number | null;

  /** Raw per-unit size string, exactly as the supplier wrote it
   * (e.g. `"60gm"`, `"1.25l"`, `"40 x 125 g"`). Not normalized. */
  packUnitSize: string | null;
}

/** Empty pack data — convenience for extractors that bail early. */
export const EMPTY_PACK_DATA: PackData = {
  unitCostInclVat: null,
  packCount: null,
  packUnitSize: null,
};
