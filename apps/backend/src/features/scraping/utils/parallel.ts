import type { Browser, Page } from 'puppeteer';
import type { BrowserService } from '../../../shared/services/browser.service.js';
import { createLogger } from '../../../shared/services/logger.service.js';
import type { ProxyCredentials } from '../../../shared/services/proxy/proxy.types.js';
import type { StreamingScrapeStats } from '../scraping.types.js';

/**
 * Stats tracked per-category for parallel scraping.
 * These get merged into the final StreamingScrapeStats.
 */
export interface CategoryStats {
  totalFetched: number;
  totalMatched: number;
  totalSaved: number;
  totalSkipped: number;
  batchCount: number;
  failedBatches: number;
  failedBatchDetails: Array<{ batchIndex: number; error: string }>;
}

/**
 * Result of scraping a single category.
 */
export interface CategoryScrapeResult {
  /** Category identifier (flexible for different category types) */
  categoryKey: string;
  productCount: number;
  pagesScraped: number;
  error?: string;
  stats: CategoryStats;
}

/**
 * Split an array into chunks of specified size.
 * Used for parallel batch processing of categories.
 */
export function chunkArray<T>(array: readonly T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize) as T[]);
  }
  return chunks;
}

/**
 * Create a new browser page with cookies from source page.
 * Used for parallel category scraping within a single scraper's browser.
 *
 * @param browserService - Browser service for page creation utilities
 * @param browser - The scraper's dedicated browser instance
 * @param sourcePage - Page to copy cookies from
 * @param proxyCredentials - Optional proxy credentials for page authentication
 */
export async function createAuthenticatedPage(
  browserService: BrowserService,
  browser: Browser,
  sourcePage: Page,
  proxyCredentials?: ProxyCredentials
): Promise<Page> {
  const newPage = await browserService.createPageInBrowser(browser, { proxyCredentials });

  // Get cookies from the source page and apply to new page
  const cookies = await sourcePage.cookies();
  if (cookies.length > 0) {
    await newPage.setCookie(...cookies);
  }

  return newPage;
}

/**
 * Merge category stats into the main stats object.
 */
export function mergeStats(main: StreamingScrapeStats, category: CategoryScrapeResult): void {
  main.totalFetched += category.stats.totalFetched;
  main.totalMatched += category.stats.totalMatched;
  main.totalSaved += category.stats.totalSaved;
  main.totalSkipped += category.stats.totalSkipped;
  main.batchCount += category.stats.batchCount;
  main.failedBatches += category.stats.failedBatches;
  main.failedBatchDetails.push(...category.stats.failedBatchDetails);
}

/**
 * Create initial empty category stats.
 */
export function createEmptyCategoryStats(): CategoryStats {
  return {
    totalFetched: 0,
    totalMatched: 0,
    totalSaved: 0,
    totalSkipped: 0,
    batchCount: 0,
    failedBatches: 0,
    failedBatchDetails: [],
  };
}

/**
 * Create initial empty streaming stats.
 */
export function createEmptyStreamingStats(): StreamingScrapeStats {
  return {
    totalFetched: 0,
    totalMatched: 0,
    totalSaved: 0,
    totalSkipped: 0,
    batchCount: 0,
    failedBatches: 0,
    failedBatchDetails: [],
  };
}

/**
 * Create a page pool for parallel scraping within a scraper's dedicated browser.
 * Pages are created in parallel for faster initialization.
 *
 * @param browserService - Browser service for page creation utilities
 * @param browser - The scraper's dedicated browser instance
 * @param sourcePage - Page to copy cookies from (usually the login page)
 * @param poolSize - Number of pages to create
 * @param proxyCredentials - Optional proxy credentials for page authentication
 */
export async function createPagePool(
  browserService: BrowserService,
  browser: Browser,
  sourcePage: Page,
  poolSize: number,
  proxyCredentials?: ProxyCredentials
): Promise<Page[]> {
  // Create pages in parallel for faster initialization
  const pagePromises = Array(poolSize)
    .fill(null)
    .map(() => createAuthenticatedPage(browserService, browser, sourcePage, proxyCredentials));

  return Promise.all(pagePromises);
}

/**
 * Close all pages in a page pool.
 */
export async function closePagePool(
  browserService: BrowserService,
  pagePool: Page[],
  logPrefix = 'Scraper'
): Promise<void> {
  const log = createLogger(logPrefix);

  for (const page of pagePool) {
    try {
      await browserService.closePage(page);
    } catch (err) {
      log.warn({ err }, 'Error closing page from pool');
    }
  }
}
