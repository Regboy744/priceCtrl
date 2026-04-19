import type { ScrapedProduct } from '../../scraping/scraping.types.js';

export interface ValueCentreRawProduct {
  name: string | null;
  price: string | null;
  sku: string | null;
  ean: string | null;
  availability: string | null;
  unitSize: string | null;
  vatRate: string | null;
  productUrl?: string | null;
}

export interface ValueCentreProductMetadata extends Record<string, unknown> {
  productUrl?: string;
  category?: string;
  brand?: string;
}

export interface ValueCentreScrapedProduct extends ScrapedProduct {
  metadata?: ValueCentreProductMetadata;
}

export interface ValueCentrePaginationInfo {
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
}
