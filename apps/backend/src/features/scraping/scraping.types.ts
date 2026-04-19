import type { SupplierCredentials } from '../../shared/services/vault.service.js';

/**
 * Status of a scraping job
 */
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Mode of scraping operation
 * - baseline: First company scraped for a supplier, prices go to supplier_products
 * - re-baseline: Same baseline company re-scraped, updates supplier_products
 * - delta: Different company scraped, only stores price differences in supplier_company_prices
 */
export type ScrapingMode = 'baseline' | 're-baseline' | 'delta';

/**
 * Product data extracted from supplier website
 */
export interface ScrapedProduct {
  /** Supplier's internal product code/SKU */
  supplierProductCode: string;
  /** EAN/barcode of the product */
  eanCode: string;
  /** Product name/description */
  name: string;
  /** Current price */
  price: number;
  /** VAT rate as percentage (e.g., 23 for 23%) */
  vatRate?: number;
  /** Unit of measure (e.g., "1x6", "Case of 12") */
  unitSize?: string;
  /** Availability status */
  availability: 'available' | 'out_of_stock' | 'discontinued' | 'unknown' | 'not_found';
  /** Any additional data specific to the supplier */
  metadata?: Record<string, unknown>;
}

/**
 * Result of a scraping operation
 */
export interface ScrapeResult {
  /** Unique identifier for this scrape run */
  runId: string;
  /** Supplier identifier */
  supplierId: string;
  /** Supplier name */
  supplierName: string;
  /** Location used for credentials (if applicable) */
  locationId?: string;
  /** Company this scrape was for */
  companyId: string;
  /** Scraping mode used */
  scrapingMode: ScrapingMode;
  /** Status of the scrape */
  status: JobStatus;
  /** When the scrape started */
  startedAt: Date;
  /** When the scrape completed */
  completedAt?: Date;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Number of products scraped */
  productCount: number;
  /** Number of products saved (baseline/re-baseline) or deltas saved */
  savedCount: number;
  /** Scraped products (only populated on success) */
  products: ScrapedProduct[];
  /** Error message if failed */
  error?: string;
  /** Error stack trace (dev only) */
  errorStack?: string;
}

/**
 * Configuration for a scraping job
 */
export interface ScrapeJobConfig {
  /** Supplier ID to scrape */
  supplierId: string;
  /** Location ID used for credentials (if applicable) */
  locationId?: string;
  /** Company ID used for baseline/delta logic */
  companyId: string;
  /** Whether this is a manual trigger */
  isManual: boolean;
  /** Priority (lower = higher priority) */
  priority?: number;
}

/**
 * In-memory job tracking
 */
export interface ScrapingJob {
  id: string;
  config: ScrapeJobConfig;
  status: JobStatus;
  result?: ScrapeResult;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Statistics for scraping operations
 */
export interface ScrapingStats {
  totalJobs: number;
  pendingJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  lastRunAt?: Date;
  averageDurationMs?: number;
}

/**
 * Interface that all supplier scrapers must implement
 */
export interface ISupplierScraper {
  /** Unique identifier matching suppliers.id in database. Set by registry during initialization. */
  supplierId: string;

  /** Supplier name as stored in database - used for ID lookup */
  readonly supplierName: string;

  /** Human-readable display name */
  readonly name: string;

  /** Base URL of the supplier website */
  readonly baseUrl: string;

  /**
   * Initialize the scraper (e.g., launch browser, load page)
   */
  initialize(): Promise<void>;

  /**
   * Perform login with the provided credentials
   */
  login(credentials: SupplierCredentials): Promise<void>;

  /**
   * Scrape all products from the supplier with streaming save support.
   * Products are saved incrementally via the callback as batches arrive,
   * reducing memory usage for large catalogs.
   *
   * @param onBatchReady - Callback to save each batch of products (provided by ScrapingService)
   * @returns Statistics about the scrape operation
   */
  scrapeProducts(onBatchReady?: ProductBatchSaveCallback): Promise<StreamingScrapeStats>;

  /**
   * Check if the supplier website is accessible
   */
  healthCheck(): Promise<boolean>;

  /**
   * Clean up resources (e.g., close browser pages)
   */
  cleanup(): Promise<void>;
}

/**
 * Events emitted during scraping
 */
export type ScrapingEvent =
  | { type: 'job:started'; jobId: string; supplierId: string }
  | { type: 'job:progress'; jobId: string; message: string; progress?: number }
  | { type: 'job:completed'; jobId: string; result: ScrapeResult }
  | { type: 'job:failed'; jobId: string; error: string }
  | { type: 'schedule:triggered'; triggeredAt: Date };

// ============ Streaming/Batch Save Types ============

/**
 * Result of saving a single batch of products.
 * Returned by the batch save callback to report progress.
 */
export interface BatchSaveResult {
  /** Number of products in the batch received from scraper */
  batchSize: number;
  /** Number of products that matched master products */
  matchedCount: number;
  /** Number of products successfully saved to database */
  savedCount: number;
  /** Number of products skipped (no master product match) */
  skippedCount: number;
  /** Error message if batch save failed */
  error?: string;
}

/**
 * Statistics from a streaming scrape operation.
 * Tracks progress across all batches.
 */
export interface StreamingScrapeStats {
  /** Total products received from supplier (after transformation) */
  totalFetched: number;
  /** Total products that matched master products */
  totalMatched: number;
  /** Total products successfully saved to database */
  totalSaved: number;
  /** Total products skipped (no master product match) */
  totalSkipped: number;
  /** Number of batches processed */
  batchCount: number;
  /** Number of batches that failed to save */
  failedBatches: number;
  /** Details of failed batches for debugging */
  failedBatchDetails: Array<{ batchIndex: number; error: string }>;
}

/**
 * Callback for saving a batch of products during streaming scrape.
 * Provided by ScrapingService, called by scrapers as each batch is ready.
 * This allows products to be saved incrementally instead of accumulating in memory.
 */
export type ProductBatchSaveCallback = (products: ScrapedProduct[]) => Promise<BatchSaveResult>;
