import type { PackData } from '../../../shared/services/pack-parser/index.js';
import type { ScrapedProduct } from '../../scraping/scraping.types.js';

export interface OreillysRawProduct {
  name: string | null;
  price: string | null;
  sku: string | null;
  ean: string | null;
  availability: string | null;
  unitSize: string | null;
  vatRate: string | null;
  productUrl?: string | null;
  pack?: PackData;
}

export interface OreillysProductMetadata extends Record<string, unknown> {
  productUrl?: string;
  category?: string;
  brand?: string;
}

export interface OreillysScrapedProduct extends ScrapedProduct {
  metadata?: OreillysProductMetadata;
}

export interface OreillysPaginationInfo {
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
}
