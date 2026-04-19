/**
 * Musgrave Marketplace API Response Parser
 *
 * Transforms raw API product data into standardized ScrapedProduct format.
 * Replaces the DOM parsing from the original scraper.
 *
 * Key transformations:
 * - Extract attributes from nested array structure
 * - Handle different value types (string, boolean, object, array)
 * - Select primary EAN code from additionalEAN array
 * - Map availability flags to status enum
 * - Parse VAT rate codes to percentages
 */

import { createLogger } from '../../../shared/services/logger.service.js';
import type { ScrapedProduct } from '../../scraping/scraping.types.js';
import { MUSGRAVE_CONFIG } from './musgrave.config.js';
import { extractMusgravePackData } from './musgrave.pack-extractor.js';
import type {
  MusgraveApiAttribute,
  MusgraveApiProduct,
  MusgraveExtractedProduct,
  MusgraveProductMetadata,
} from './musgrave.types.js';

const CONFIG = MUSGRAVE_CONFIG;
const ATTRS = CONFIG.attributes;
const log = createLogger('MusgraveParser');

// ============ Attribute Extraction ============

/**
 * Extract attribute value from product attributes array.
 *
 * The API returns attributes as an array of {name, value} objects.
 * Value types vary by attribute:
 * - string: sku, image, taxRate, size, GPC-category-code
 * - boolean: inStock, availability, isPromotionalPrice
 * - { value: number }: listPrice, salePrice
 * - string[]: AdditionalEAN
 *
 * @param attributes - Array of attribute objects
 * @param attributeName - Name of the attribute to find
 * @returns The attribute value or null if not found
 */
function getAttributeValue<T = unknown>(
  attributes: MusgraveApiAttribute[],
  attributeName: string
): T | null {
  const attribute = attributes.find((attr) => attr.name === attributeName);
  return attribute ? (attribute.value as T) : null;
}

/**
 * Extract price from attribute.
 *
 * Price attributes come as objects with a 'value' property: { value: 12.99 }
 * Sometimes they might be direct numbers.
 *
 * @param attributes - Array of attribute objects
 * @param attributeName - Name of the price attribute
 * @returns Price as number or null
 */
function extractPrice(attributes: MusgraveApiAttribute[], attributeName: string): number | null {
  const attr = getAttributeValue<{ value?: number } | number>(attributes, attributeName);

  if (attr === null || attr === undefined) return null;
  if (typeof attr === 'number') return attr;
  if (typeof attr === 'object' && 'value' in attr && typeof attr.value === 'number') {
    return attr.value;
  }

  return null;
}

// ============ Data Extraction ============

/**
 * Extract all data from API product into a flat object.
 *
 * This mirrors the extractProductData function from saveMKPDataDb.js
 *
 * @param product - Raw API product
 * @returns Extracted product data
 */
export function extractProductData(product: MusgraveApiProduct): MusgraveExtractedProduct {
  // Musgrave splits attributes across two channels:
  //   product.attributes                       — top-level resource attrs (UCIV, size, prices…)
  //   product.attributeGroup.attributes        — group attrs (AdditionalEAN, number-of-pack-units, GPC-category-code)
  // We flatten both so downstream lookups don't have to care which channel
  // the API put a given attribute in. The public type only models `attributes`,
  // so cast the product locally to read the optional nested group.
  const grouped = (
    product as MusgraveApiProduct & {
      attributeGroup?: { attributes?: MusgraveApiAttribute[] };
    }
  ).attributeGroup;
  const attrs: MusgraveApiAttribute[] = [
    ...(product.attributes ?? []),
    ...(grouped?.attributes ?? []),
  ];

  return {
    sku: getAttributeValue<string>(attrs, ATTRS.sku),
    inStock: getAttributeValue<boolean>(attrs, ATTRS.inStock) ?? false,
    image: getAttributeValue<string>(attrs, ATTRS.image),
    listPrice: extractPrice(attrs, ATTRS.listPrice),
    salePrice: extractPrice(attrs, ATTRS.salePrice),
    isPromotionalPrice: getAttributeValue<boolean>(attrs, ATTRS.isPromotionalPrice) ?? false,
    availability: getAttributeValue<boolean>(attrs, ATTRS.availability) ?? false,
    taxRate: getAttributeValue<string>(attrs, ATTRS.taxRate),
    size: getAttributeValue<string>(attrs, ATTRS.size),
    additionalEAN: getAttributeValue<string[]>(attrs, ATTRS.additionalEAN) ?? [],
    gpcCategoryCode: getAttributeValue<string>(attrs, ATTRS.gpcCategoryCode),
    title: product.title || '',
    uri: product.uri || '',
  };
}

// ============ EAN Handling ============

/**
 * Validate EAN code format.
 *
 * Valid EAN formats:
 * - EAN-8: 8 digits
 * - UPC-A: 12 digits
 * - EAN-13: 13 digits
 * - GTIN-14: 14 digits
 *
 * @param ean - EAN code string
 * @returns true if valid
 */
function isValidEan(ean: string): boolean {
  if (!ean) return false;
  const cleaned = ean.replace(/\D/g, '');
  return [8, 12, 13, 14].includes(cleaned.length);
}

/**
 * Get primary EAN code from additionalEAN array.
 *
 * The additionalEAN array may contain multiple EAN codes.
 * We prefer EAN-13 (13 digits) as it's the most common format.
 *
 * @param additionalEANs - Array of EAN codes
 * @returns Primary EAN code or empty string
 */
function getPrimaryEan(additionalEANs: string[]): string {
  if (!additionalEANs || additionalEANs.length === 0) return '';

  // Filter to valid EANs only
  const validEans = additionalEANs.filter(isValidEan);
  if (validEans.length === 0) return '';

  // Prefer EAN-13 (most common for retail products)
  const ean13 = validEans.find((ean) => ean.length === 13);
  if (ean13) return ean13;

  // Fall back to first valid EAN
  return validEans[0];
}

// ============ VAT Rate Parsing ============

/**
 * Parse VAT rate code to percentage.
 *
 * Irish VAT rate codes:
 * - S: Standard rate (23%)
 * - Z: Zero rate (0%)
 * - R1: Reduced rate 1 (13.5%)
 * - R2: Reduced rate 2 (9%)
 * - L: Livestock/exempt (0%)
 *
 * @param taxRateCode - Tax rate code string
 * @returns VAT rate as decimal (0.23 for 23%)
 */
function parseVatRate(taxRateCode: string | number | null | unknown): number {
  if (taxRateCode === null || taxRateCode === undefined) return 0;

  // Handle numeric VAT rates (API returns decimal like 0.23 for 23%)
  // Database expects decimal format, so use directly
  if (typeof taxRateCode === 'number') {
    return taxRateCode;
  }

  // Handle string VAT rate codes (legacy format)
  if (typeof taxRateCode !== 'string') {
    log.warn({ type: typeof taxRateCode, value: taxRateCode }, 'Unexpected taxRateCode type');
    return 0;
  }

  // Config has percentages (23, 13.5), convert to decimal (0.23, 0.135)
  const code = taxRateCode.toUpperCase().trim();
  const percentage = CONFIG.vatRates[code] ?? 0;
  return percentage / 100;
}

// ============ Availability Mapping ============

/**
 * Map availability flags to standardized status.
 *
 * The API provides two boolean flags:
 * - availability: whether the product is generally available
 * - inStock: whether it's currently in stock
 *
 * @param availability - General availability flag
 * @param inStock - Current stock flag
 * @returns Standardized availability status
 */
function mapAvailability(
  availability: boolean,
  inStock: boolean
): 'available' | 'out_of_stock' | 'discontinued' | 'unknown' {
  // Not available at all = discontinued
  if (!availability) return 'discontinued';

  // Available but not in stock
  if (!inStock) return 'out_of_stock';

  // Available and in stock
  return 'available';
}

// ============ URL Building ============

/**
 * Build full product URL from URI.
 *
 * @param uri - Product URI path
 * @returns Full product URL
 */
function buildProductUrl(uri: string): string {
  if (!uri) return '';
  // Ensure URI starts with /
  const path = uri.startsWith('/') ? uri : `/${uri}`;
  return `${CONFIG.baseUrl}${path}`;
}

/**
 * Build full image URL from image path.
 *
 * @param imagePath - Image path from API
 * @returns Full image URL
 */
function buildImageUrl(imagePath: string | null): string | undefined {
  if (!imagePath) return undefined;
  // Image paths from API are relative to the API base
  if (imagePath.startsWith('http')) return imagePath;
  return `https://www-api.musgravemarketplace.ie${imagePath}`;
}

// ============ Main Transformation ============

/**
 * Transform a single API product to standardized ScrapedProduct format.
 *
 * @param apiProduct - Raw API product
 * @returns Transformed ScrapedProduct or null if product is invalid
 */
export function transformToScrapedProduct(apiProduct: MusgraveApiProduct): ScrapedProduct | null {
  // Extract all data first
  const extracted = extractProductData(apiProduct);
  // Pack metadata (UCIV, pack count, size) — source of truth for the
  // cross-supplier unit-cost comparison. Pure, reads structured API fields.
  const pack = extractMusgravePackData(apiProduct);

  // Get primary EAN code - required for matching to master products
  const eanCode = getPrimaryEan(extracted.additionalEAN);
  if (!eanCode) {
    // Skip products without valid EAN - can't match to master products
    return null;
  }

  // Get price - prefer sale price if available
  const price = extracted.salePrice ?? extracted.listPrice;
  if (price === null || price <= 0) {
    // Skip products without valid price
    return null;
  }

  // Build metadata for additional information
  const metadata: MusgraveProductMetadata = {
    productUrl: buildProductUrl(extracted.uri),
    image: buildImageUrl(extracted.image),
    gpcCategoryCode: extracted.gpcCategoryCode ?? undefined,
    isPromo: extracted.isPromotionalPrice,
  };

  // Include list price if different from sale price (for reference)
  if (extracted.listPrice && extracted.listPrice !== price) {
    metadata.listPrice = extracted.listPrice;
  }

  // Include promo price if it's a promotional item
  if (extracted.isPromotionalPrice && extracted.salePrice) {
    metadata.promoPrice = extracted.salePrice;
  }

  // Include additional EANs if there are multiple
  if (extracted.additionalEAN.length > 1) {
    metadata.additionalEANs = extracted.additionalEAN;
  }

  // Pack metadata propagated to supplier_products via scraping.service.
  if (pack.unitCostInclVat !== null) metadata.unit_cost_incl_vat = pack.unitCostInclVat;
  if (pack.packCount !== null) metadata.pack_count = pack.packCount;
  if (pack.packUnitSize) metadata.pack_unit_size = pack.packUnitSize;

  return {
    supplierProductCode: extracted.sku ?? '',
    eanCode,
    name: extracted.title || 'Unknown Product',
    price,
    vatRate: parseVatRate(extracted.taxRate),
    unitSize: extracted.size ?? undefined,
    availability: mapAvailability(extracted.availability, extracted.inStock),
    metadata,
  };
}

/**
 * Transform multiple API products to ScrapedProduct array.
 *
 * Filters out products that can't be transformed (missing EAN/price).
 * Logs statistics about filtered products.
 *
 * @param apiProducts - Array of raw API products
 * @returns Array of transformed ScrapedProduct objects
 */
export function transformApiProducts(apiProducts: MusgraveApiProduct[]): ScrapedProduct[] {
  const products: ScrapedProduct[] = [];
  let skippedNoEan = 0;
  let skippedNoPrice = 0;

  for (const apiProduct of apiProducts) {
    const extracted = extractProductData(apiProduct);
    const eanCode = getPrimaryEan(extracted.additionalEAN);

    if (!eanCode) {
      skippedNoEan++;
      continue;
    }

    const price = extracted.salePrice ?? extracted.listPrice;
    if (price === null || price <= 0) {
      skippedNoPrice++;
      continue;
    }

    const product = transformToScrapedProduct(apiProduct);
    if (product) {
      products.push(product);
    }
  }

  // Log statistics if any products were skipped
  if (skippedNoEan > 0 || skippedNoPrice > 0) {
    log.debug(
      { transformed: products.length, skippedNoEan, skippedNoPrice },
      'Transformed API products'
    );
  }

  return products;
}
