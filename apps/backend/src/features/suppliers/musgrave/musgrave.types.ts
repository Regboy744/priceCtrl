import type { ScrapedProduct } from '../../scraping/scraping.types.js';

// ============ API Response Types ============

/**
 * Raw attribute from Musgrave API response.
 * Value type varies by attribute name:
 * - string: sku, image, taxRate, size, GPC-category-code
 * - boolean: inStock, availability, isPromotionalPrice
 * - { value: number }: listPrice, salePrice
 * - string[]: AdditionalEAN
 */
export interface MusgraveApiAttribute {
  name: string;
  value: unknown;
}

/**
 * Product from Musgrave API response.
 */
export interface MusgraveApiProduct {
  title: string;
  uri: string;
  attributes: MusgraveApiAttribute[];
}

/**
 * API response wrapper from Musgrave products endpoint.
 */
export interface MusgraveApiResponse {
  elements: MusgraveApiProduct[];
  total?: number;
  offset?: number;
  amount?: number;
}

// ============ Authentication Types ============

/**
 * Authentication tokens extracted from cookies after login.
 * Required for API access.
 */
export interface MusgraveAuthTokens {
  /** Decoded API token for authentication header */
  apiToken: string;
  /** Personalization group ID for user-specific catalog */
  pgId: string;
}

/**
 * Result of a single page fetch operation.
 */
export interface MusgravePageFetchResult {
  success: boolean;
  data: MusgraveApiProduct[];
  offset: number;
  error?: {
    status: number;
    message: string;
  };
}

/**
 * Statistics from a fetch operation.
 */
export interface MusgraveFetchStats {
  totalFetched: number;
  totalBatches: number;
  failedBatches: number;
  rateLimitHits: number;
  reauthCount: number;
}

// ============ Extracted Product Data ============

/**
 * Extracted product data from API (before transformation to ScrapedProduct).
 */
export interface MusgraveExtractedProduct {
  sku: string | null;
  inStock: boolean;
  image: string | null;
  listPrice: number | null;
  salePrice: number | null;
  isPromotionalPrice: boolean;
  availability: boolean;
  taxRate: string | null;
  size: string | null;
  additionalEAN: string[];
  gpcCategoryCode: string | null;
  title: string;
  uri: string;
}

// ============ Metadata Types ============

/**
 * Musgrave-specific product metadata stored with ScrapedProduct.
 */
export interface MusgraveProductMetadata extends Record<string, unknown> {
  /** Original URL of the product page */
  productUrl?: string;
  /** Product image URL */
  image?: string;
  /** GPC category code */
  gpcCategoryCode?: string;
  /** All EAN codes (if more than one) */
  additionalEANs?: string[];
  /** Whether product is on promotion */
  isPromo?: boolean;
  /** Promotional price if any */
  promoPrice?: number;
  /** List price (non-sale price) */
  listPrice?: number;
  /** Per-consumer-unit cost (VAT incl). Mirrors `supplier_products.unit_cost_incl_vat`. */
  unit_cost_incl_vat?: number;
  /** Consumer units per pack. Mirrors `supplier_products.pack_count`. */
  pack_count?: number;
  /** Raw supplier pack size string. Mirrors `supplier_products.pack_unit_size`. */
  pack_unit_size?: string;
}

/**
 * Extended scraped product with Musgrave-specific data.
 */
export interface MusgraveScrapedProduct extends ScrapedProduct {
  metadata?: MusgraveProductMetadata;
}

// ============ Login Types ============

/**
 * Login response data.
 */
export interface MusgraveLoginResponse {
  success: boolean;
  errorMessage?: string;
  tokens?: MusgraveAuthTokens;
}

// ============ OAuth2 Token Response ============

/**
 * Response from POST /token (OAuth2 password grant).
 */
export interface MusgraveTokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in: number;
  refresh_expires_in?: number;
  token_type: string;
}

/**
 * Response from GET /personalization.
 */
export interface MusgravePersonalizationResponse {
  type?: string;
  pgid: string;
}

// ============ Callback Types ============

/**
 * Callback function for processing batches of products during fetch.
 * Called after each successful parallel fetch batch.
 */
export type MusgraveBatchCallback = (products: MusgraveApiProduct[]) => Promise<void>;

/**
 * Callback function for re-authentication when token expires.
 * Should perform login again and return new tokens.
 */
export type MusgraveReauthCallback = () => Promise<MusgraveAuthTokens | null>;
