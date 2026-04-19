import type { SupplierCredentials } from '../../../shared/services/vault.service.js';
import { BaseScraper } from '../../scraping/base.scraper.js';
import type {
  ProductBatchSaveCallback,
  ScrapedProduct,
  StreamingScrapeStats,
} from '../../scraping/scraping.types.js';
import { VALUE_CENTRE_CONFIG } from './value-centre.config.js';
import {
  hasProductsLoaded,
  parsePaginationInfo,
  parseProductsFromPage,
  transformToScrapedProduct,
} from './value-centre.parser.js';

/**
 * Scraper for Value Centre wholesale supplier.
 */
export class ValueCentreScraper extends BaseScraper {
  readonly supplierName = 'Value Centre';
  readonly name = 'Value Centre';
  readonly baseUrl = VALUE_CENTRE_CONFIG.baseUrl;

  async login(credentials: SupplierCredentials): Promise<void> {
    await this.ensureInitialized();

    await this.performLoginWithRetry(credentials, async () => {
      const page = this.getPage();
      const { selectors, loginUrl } = VALUE_CENTRE_CONFIG;

      await this.navigateTo(loginUrl);
      await this.delay(1000, 2000);

      await this.waitForSelector(selectors.login.usernameInput);

      await this.typeText(selectors.login.usernameInput, credentials.username);
      await this.delay(500, 1000);

      await this.typeText(selectors.login.passwordInput, credentials.password);
      await this.delay(500, 1000);

      await this.clickAndWait(selectors.login.submitButton, true);

      const loggedIn = await this.verifyLogin(selectors.login.successIndicator);
      if (!loggedIn) {
        const errorText = await this.getText(selectors.login.errorMessage);
        throw new Error(errorText ?? 'Login failed');
      }

      this.log.info('Successfully logged in');
    });
  }

  async scrapeProducts(onBatchReady?: ProductBatchSaveCallback): Promise<StreamingScrapeStats> {
    await this.ensureInitialized();
    const page = this.getPage();
    const allProducts: ScrapedProduct[] = [];

    this.log.info('Starting product scrape');

    try {
      await this.navigateTo(VALUE_CENTRE_CONFIG.productsUrl);
      await this.delay(2000, 3000);

      if (!(await hasProductsLoaded(page))) {
        this.log.warn('No products found');
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

      let currentPage = 1;
      let hasMore = true;

      while (hasMore) {
        this.log.debug({ currentPage }, 'Scraping page');

        await this.scrollToLoadAll();
        await this.delay(1000, 2000);

        const rawProducts = await parseProductsFromPage(page);

        for (const raw of rawProducts) {
          const product = transformToScrapedProduct(raw);
          if (product) allProducts.push(product);
        }

        const pagination = await parsePaginationInfo(page);
        hasMore = pagination.hasNextPage;

        if (hasMore) {
          const nextClicked = await this.goToNextPage();
          if (!nextClicked) break;
          currentPage++;
          await this.delay(
            VALUE_CENTRE_CONFIG.delayBetweenPages.min,
            VALUE_CENTRE_CONFIG.delayBetweenPages.max
          );
        }
      }

      this.log.info({ totalFetched: allProducts.length }, 'Scrape complete');

      // Call the batch callback with all products (temporary until refactored for true streaming)
      if (onBatchReady && allProducts.length > 0) {
        const result = await onBatchReady(allProducts);
        return {
          totalFetched: allProducts.length,
          totalMatched: result.matchedCount,
          totalSaved: result.savedCount,
          totalSkipped: result.skippedCount,
          batchCount: 1,
          failedBatches: result.error ? 1 : 0,
          failedBatchDetails: result.error ? [{ batchIndex: 0, error: result.error }] : [],
        };
      }

      // No callback provided - return stats without saving
      return {
        totalFetched: allProducts.length,
        totalMatched: 0,
        totalSaved: 0,
        totalSkipped: 0,
        batchCount: 0,
        failedBatches: 0,
        failedBatchDetails: [],
      };
    } catch (error) {
      this.log.error({ err: error }, 'Error during scrape');
      throw error;
    }
  }

  private async goToNextPage(): Promise<boolean> {
    const page = this.getPage();
    const { selectors } = VALUE_CENTRE_CONFIG;

    try {
      const nextButton = await page.$(selectors.pagination.nextButton);
      if (!nextButton) return false;

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
        nextButton.click(),
      ]);

      await page.waitForSelector(selectors.products.item, { timeout: 10000 });
      return true;
    } catch {
      return false;
    }
  }
}
