import type { Page } from 'puppeteer';
import type { SupplierCredentials } from '../../../shared/services/vault.service.js';
import { BaseScraper } from '../base.scraper.js';
import type {
  ProductBatchSaveCallback,
  ScrapedProduct,
  StreamingScrapeStats,
} from '../scraping.types.js';
import { humanDelay } from '../utils/human-behavior.js';
import {
  type CategoryScrapeResult,
  chunkArray,
  closePagePool,
  createEmptyCategoryStats,
  createEmptyStreamingStats,
  createPagePool,
  mergeStats,
} from '../utils/parallel.js';
import { AuthExecutor } from './executors/auth.executor.js';
import { ExtractionExecutor } from './executors/extraction.executor.js';
import { NavigationExecutor } from './executors/navigation.executor.js';
import type { CategoryDefinition, NavigationPhase, ScraperConfig } from './types/config.types.js';
import type { TransformerMap } from './types/transformer.types.js';

/**
 * Configuration-driven scraper that executes scraping based on provided configuration.
 * This eliminates the need to write custom scraper classes for each supplier.
 */
export class ConfigurableScraper extends BaseScraper {
  readonly supplierName: string;
  readonly name: string;
  readonly baseUrl: string;

  private authExecutor: AuthExecutor;
  private navigationExecutor: NavigationExecutor;
  private extractionExecutor: ExtractionExecutor;

  /** Stored session cookies after successful login */
  private sessionCookies: Array<{ name: string; value: string }> = [];

  constructor(
    private config: ScraperConfig,
    private transformers: TransformerMap
  ) {
    super();

    this.supplierName = config.supplier.name;
    this.name = config.supplier.displayName;
    this.baseUrl = config.supplier.baseUrl;

    // Initialize executors
    this.authExecutor = new AuthExecutor(
      this.browserService,
      config.auth,
      config.browser,
      this.name
    );

    this.navigationExecutor = new NavigationExecutor(
      this.browserService,
      config.navigation,
      this.baseUrl,
      this.name
    );

    this.extractionExecutor = new ExtractionExecutor(config.extraction, transformers, this.name);
  }

  // ============ LOGIN IMPLEMENTATION ============

  /**
   * Perform login using the configured authentication flow.
   */
  async login(credentials: SupplierCredentials): Promise<void> {
    await this.ensureInitialized();

    await this.performLoginWithRetry(credentials, async () => {
      const page = this.getPage();
      await this.authExecutor.execute(page, credentials);
      await this.extractSessionCookies(page);
    });
  }

  /**
   * Extract session cookies for parallel page creation.
   */
  private async extractSessionCookies(page: Page): Promise<void> {
    const cookies = await page.cookies();
    this.sessionCookies = cookies.map((c) => ({ name: c.name, value: c.value }));
    this.log.debug({ cookieCount: this.sessionCookies.length }, 'Extracted session cookies');
  }

  // ============ PRODUCT SCRAPING ============

  /**
   * Scrape all products using parallel category processing.
   * Uses this scraper's dedicated browser for creating the page pool.
   */
  async scrapeProducts(onBatchReady?: ProductBatchSaveCallback): Promise<StreamingScrapeStats> {
    await this.ensureInitialized();

    const stats = createEmptyStreamingStats();
    const phases = this.navigationExecutor.getPhases();
    const concurrency = this.navigationExecutor.getConcurrency();

    this.log.info({ phaseCount: phases.length, concurrency }, 'Starting product scrape');

    const allResults: CategoryScrapeResult[] = [];
    const pagePool: Page[] = [];

    try {
      // Create page pool for parallel scraping using our dedicated browser
      this.log.debug({ concurrency }, 'Creating browser pages for parallel scraping');
      const mainPage = this.getPage();
      const browser = this.getBrowser();
      pagePool.push(
        ...(await createPagePool(
          this.browserService,
          browser,
          mainPage,
          concurrency,
          this.proxyCredentials
        ))
      );
      this.log.debug({ pagePoolSize: pagePool.length }, 'Page pool created successfully');

      // Process each phase
      for (const phase of phases) {
        this.log.info({ phase: phase.name }, 'Processing phase');

        // Setup phase (e.g., navigate to department)
        await this.navigationExecutor.setupPhase(mainPage, phase);

        // Re-copy cookies to page pool after phase setup
        const cookies = await mainPage.cookies();
        for (const poolPage of pagePool) {
          await poolPage.setCookie(...cookies);
        }

        // Scrape categories in this phase
        const phaseResults = await this.scrapePhaseCategories(phase, onBatchReady, stats, pagePool);
        allResults.push(...phaseResults);
      }

      // Log summary
      this.logScrapeSummary(allResults, stats);

      return stats;
    } catch (error) {
      this.log.error({ err: error }, 'Error during scrape');
      throw error;
    } finally {
      // Clean up page pool
      this.log.debug({ pagePoolSize: pagePool.length }, 'Cleaning up page pool');
      await closePagePool(this.browserService, pagePool, this.name);
    }
  }

  /**
   * Scrape all categories in a phase using parallel processing.
   */
  private async scrapePhaseCategories(
    phase: NavigationPhase,
    onBatchReady: ProductBatchSaveCallback | undefined,
    stats: StreamingScrapeStats,
    pagePool: Page[]
  ): Promise<CategoryScrapeResult[]> {
    const results: CategoryScrapeResult[] = [];
    const concurrency = pagePool.length;
    const delays = this.navigationExecutor.getDelays();

    // Split categories into chunks for parallel processing
    const categoryChunks = chunkArray(phase.categories, concurrency);
    this.log.debug(
      { phase: phase.name, batchCount: categoryChunks.length, concurrency },
      'Processing phase category batches'
    );

    for (let chunkIndex = 0; chunkIndex < categoryChunks.length; chunkIndex++) {
      const chunk = categoryChunks[chunkIndex];
      this.log.debug(
        {
          phase: phase.name,
          batchNum: chunkIndex + 1,
          totalBatches: categoryChunks.length,
          categoryCount: chunk.length,
        },
        'Processing category batch'
      );

      // Process all categories in this chunk in parallel
      const chunkPromises = chunk.map((category, idx) =>
        this.scrapeCategory(category, onBatchReady, pagePool[idx])
      );

      const settledResults = await Promise.allSettled(chunkPromises);

      // Process results from this chunk
      for (let i = 0; i < settledResults.length; i++) {
        const settled = settledResults[i];
        const category = chunk[i];
        const categoryKey = this.navigationExecutor.getCategoryKey(category);

        if (settled.status === 'fulfilled') {
          const result = settled.value;
          results.push(result);
          mergeStats(stats, result);
        } else {
          // Promise rejected - create error result
          const errorResult: CategoryScrapeResult = {
            categoryKey,
            productCount: 0,
            pagesScraped: 0,
            error:
              settled.reason instanceof Error ? settled.reason.message : String(settled.reason),
            stats: createEmptyCategoryStats(),
          };
          results.push(errorResult);
          this.log.error({ categoryKey, err: settled.reason }, 'Category failed');
        }
      }

      // Delay between batches
      if (chunkIndex < categoryChunks.length - 1) {
        await humanDelay(delays.betweenCategories.min, delays.betweenCategories.max);
      }
    }

    return results;
  }

  /**
   * Scrape a single category, processing pages sequentially.
   */
  private async scrapeCategory(
    category: CategoryDefinition,
    onBatchReady: ProductBatchSaveCallback | undefined,
    page: Page
  ): Promise<CategoryScrapeResult> {
    const categoryKey = this.navigationExecutor.getCategoryKey(category);
    const delays = this.navigationExecutor.getDelays();
    const result: CategoryScrapeResult = {
      categoryKey,
      productCount: 0,
      pagesScraped: 0,
      stats: createEmptyCategoryStats(),
    };

    try {
      // Navigate to first page
      await this.navigationExecutor.navigateToCategory(page, category, 1);

      // Check if products loaded
      const loaded = await this.extractionExecutor.areProductsLoaded(page);
      if (!loaded) {
        this.log.warn({ categoryKey }, 'No products found in category');
        return result;
      }

      // Get total pages
      const totalPages = await this.navigationExecutor.getTotalPages(page);
      this.log.debug({ categoryKey, totalPages }, 'Category total pages resolved');

      // Process each page
      for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
        // Navigate to page if not first page
        if (currentPage > 1) {
          await this.navigationExecutor.navigateToCategory(page, category, currentPage);

          // Check if products loaded
          const pageLoaded = await this.extractionExecutor.areProductsLoaded(page);
          if (!pageLoaded) {
            this.log.warn({ categoryKey, currentPage }, 'No products found on category page');
            break;
          }
        }

        this.log.debug({ categoryKey, currentPage, totalPages }, 'Scraping category page');

        // Extract products
        const products = await this.extractionExecutor.extractProducts(page);

        result.productCount += products.length;
        result.pagesScraped++;
        result.stats.totalFetched += products.length;

        // Stream save via callback
        if (onBatchReady && products.length > 0) {
          result.stats.batchCount++;
          try {
            const batchResult = await onBatchReady(products);
            result.stats.totalMatched += batchResult.matchedCount;
            result.stats.totalSaved += batchResult.savedCount;
            result.stats.totalSkipped += batchResult.skippedCount;
            if (batchResult.error) {
              result.stats.failedBatches++;
              result.stats.failedBatchDetails.push({
                batchIndex: result.stats.batchCount,
                error: batchResult.error,
              });
            }
          } catch (error) {
            result.stats.failedBatches++;
            result.stats.failedBatchDetails.push({
              batchIndex: result.stats.batchCount,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        // Delay between pages
        if (currentPage < totalPages) {
          await humanDelay(delays.betweenPages.min, delays.betweenPages.max);
        }
      }

      this.log.debug(
        { categoryKey, productCount: result.productCount, pagesScraped: result.pagesScraped },
        'Category scrape complete'
      );
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      this.log.error({ categoryKey, err: error }, 'Error scraping category');
    }

    return result;
  }

  /**
   * Log scrape summary.
   */
  private logScrapeSummary(results: CategoryScrapeResult[], stats: StreamingScrapeStats): void {
    const successfulCategories = results.filter((r) => !r.error).length;
    const failedCategories = results.filter((r) => r.error).length;
    const totalProducts = results.reduce((sum, r) => sum + r.productCount, 0);

    this.log.info(
      {
        successfulCategories,
        failedCategories,
        totalProducts,
        totalSaved: stats.totalSaved,
        batchCount: stats.batchCount,
        failedBatches: stats.failedBatches,
      },
      'Scrape complete'
    );

    if (failedCategories > 0) {
      this.log.warn(
        {
          failedCategories: results
            .filter((r) => r.error)
            .map((r) => ({ categoryKey: r.categoryKey, error: r.error })),
        },
        'Failed categories detected'
      );
    }
  }

  // ============ CLEANUP ============

  /**
   * Cleanup resources.
   */
  async cleanup(): Promise<void> {
    this.sessionCookies = [];
    await super.cleanup();
  }

  /**
   * Get session cookie string for use in HTTP requests.
   */
  getSessionCookieString(): string {
    return this.sessionCookies.map((c) => `${c.name}=${c.value}`).join('; ');
  }
}
