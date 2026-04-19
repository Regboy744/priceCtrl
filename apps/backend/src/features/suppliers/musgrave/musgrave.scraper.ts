/**
 * Musgrave Marketplace Scraper
 *
 * Fully REST-based — no browser/Puppeteer needed:
 * - HTTP login via OAuth2 password grant (bypasses Radware bot detection)
 * - REST API for product fetching (parallel requests for speed)
 *
 * Auth flow:
 * 1. POST /token with credentials → access_token (JWT, 1hr expiry)
 * 2. GET /personalization with token → pgId
 * 3. Product API calls with token + pgId
 *
 * Streaming Save:
 * - Products saved incrementally via callback as batches arrive
 * - Reduces memory usage for large catalogs (50K+ products)
 */

import type { SupplierCredentials } from '../../../shared/services/vault.service.js';
import { BaseScraper } from '../../scraping/base.scraper.js';
import type {
  ProductBatchSaveCallback,
  StreamingScrapeStats,
} from '../../scraping/scraping.types.js';
import { httpLogin, musgraveApiService } from './musgrave.api.js';
import { MUSGRAVE_CONFIG } from './musgrave.config.js';
import { transformApiProducts } from './musgrave.parser.js';
import type { MusgraveAuthTokens } from './musgrave.types.js';

const CONFIG = MUSGRAVE_CONFIG;

/**
 * Scraper for Musgrave Marketplace (musgravemarketplace.ie).
 *
 * Login via pure HTTP (OAuth2 password grant to INTERSHOP REST API).
 * Product fetching via parallel REST API calls.
 */
export class MusgraveScraper extends BaseScraper {
  readonly supplierName = 'Musgrave Marketplace';
  readonly name = 'Musgrave Marketplace';
  readonly baseUrl = CONFIG.baseUrl;

  /** Authentication tokens extracted from login */
  private authTokens: MusgraveAuthTokens | null = null;

  /** Current credentials for re-authentication */
  private currentCredentials: SupplierCredentials | null = null;

  /**
   * No browser needed — override to skip Puppeteer initialization entirely.
   */
  async initialize(): Promise<void> {
    // No-op: pure HTTP scraper, no browser to create.
  }

  /**
   * Perform login to Musgrave Marketplace via HTTP.
   *
   * Uses pure REST calls (no browser, bypasses Radware):
   * 1. POST /token — OAuth2 password grant → access_token
   * 2. GET /personalization — with token → pgId
   */
  async login(credentials: SupplierCredentials): Promise<void> {
    this.currentCredentials = credentials;

    this.log.debug('Logging in via HTTP (OAuth2 password grant)');

    this.authTokens = await httpLogin(credentials.username, credentials.password);
    musgraveApiService.setTokens(this.authTokens);

    this.log.info('HTTP login successful, API tokens set');
  }

  /**
   * Re-authenticate via HTTP when token expires (401).
   */
  private async reauthenticate(): Promise<MusgraveAuthTokens | null> {
    if (!this.currentCredentials) {
      this.log.error('No credentials available for re-authentication');
      return null;
    }

    this.log.info('Re-authenticating via HTTP');

    try {
      this.authTokens = await httpLogin(
        this.currentCredentials.username,
        this.currentCredentials.password
      );
      musgraveApiService.setTokens(this.authTokens);
      return this.authTokens;
    } catch (error) {
      const err = error as Error;
      this.log.error({ err }, 'Re-authentication failed');
      return null;
    }
  }

  /**
   * Scrape all products from Musgrave Marketplace.
   *
   * Uses the REST API with parallel fetching for efficiency:
   * - 10 concurrent requests (configurable)
   * - 72 products per request
   * - Automatic rate limit handling
   * - Re-authentication on token expiry
   *
   * Products are saved incrementally via the callback to reduce memory usage.
   * Instead of accumulating all products in memory, each batch is transformed
   * and passed to the callback for immediate persistence.
   *
   * @param onBatchReady - Callback to save each batch of products (provided by ScrapingService)
   * @returns Statistics about the scrape operation
   */
  async scrapeProducts(onBatchReady?: ProductBatchSaveCallback): Promise<StreamingScrapeStats> {
    if (!this.authTokens) {
      throw new Error('Not authenticated. Call login() first.');
    }

    this.log.info('Starting product scrape via API');

    // Initialize stats for streaming scrape
    const stats: StreamingScrapeStats = {
      totalFetched: 0,
      totalMatched: 0,
      totalSaved: 0,
      totalSkipped: 0,
      batchCount: 0,
      failedBatches: 0,
      failedBatchDetails: [],
    };

    try {
      // Reset API service state for this scrape
      musgraveApiService.resetConcurrency();
      musgraveApiService.setTokens(this.authTokens);

      // Fetch all products using parallel API requests
      // Products are delivered progressively via callback
      const apiStats = await musgraveApiService.fetchAllProducts(
        // Re-authentication callback for 401 errors
        () => this.reauthenticate(),

        // Batch callback - transform and save products as they arrive
        async (apiProducts) => {
          stats.batchCount++;
          const batchIndex = stats.batchCount;

          // Transform API products to ScrapedProduct format
          const transformed = transformApiProducts(apiProducts);
          stats.totalFetched += transformed.length;

          // If callback provided, save the batch immediately
          if (onBatchReady && transformed.length > 0) {
            const result = await onBatchReady(transformed);

            stats.totalMatched += result.matchedCount;
            stats.totalSaved += result.savedCount;
            stats.totalSkipped += result.skippedCount;

            if (result.error) {
              stats.failedBatches++;
              stats.failedBatchDetails.push({ batchIndex, error: result.error });
              this.log.warn({ batchIndex, error: result.error }, 'Batch save failed');
            }

            this.log.debug(
              {
                batchIndex,
                fetched: transformed.length,
                matched: result.matchedCount,
                saved: result.savedCount,
              },
              'Batch processed'
            );
          } else {
            // No callback - just log progress (products not saved)
            this.log.debug({ batchIndex, transformed: transformed.length }, 'Batch transformed');
          }
        }
      );

      this.log.info(
        {
          totalFetched: stats.totalFetched,
          totalMatched: stats.totalMatched,
          totalSaved: stats.totalSaved,
          apiBatches: apiStats.totalBatches,
          failedApiBatches: apiStats.failedBatches,
          rateLimitHits: apiStats.rateLimitHits,
          reauthCount: apiStats.reauthCount,
        },
        'Scrape complete'
      );

      return stats;
    } catch (error) {
      const err = error as Error;
      this.log.error({ err }, 'Error during API scrape');
      throw error;
    }
  }

  /**
   * Health check — verify the Musgrave API is accessible.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(CONFIG.personalizationUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10_000),
      });
      const ok = res.status < 500;
      this.log.debug({ status: res.status }, ok ? 'Health check passed' : 'Health check failed');
      return ok;
    } catch (error) {
      this.log.error({ err: error }, 'Health check failed');
      return false;
    }
  }

  /**
   * Cleanup resources.
   */
  async cleanup(): Promise<void> {
    musgraveApiService.clearTokens();
    this.authTokens = null;
    this.currentCredentials = null;
    await super.cleanup();
  }
}
