/**
 * Savage & Whitten Scraper
 *
 * Pure curl-impersonate approach — NO browser at all:
 * - HTTP POST to /umbraco/surface/UmbracoLogin/HandleLogin for authentication
 * - curl-impersonate + cheerio for product scraping
 *
 * Login flow:
 *   1. GET /login → collect cookies + __RequestVerificationToken (CSRF)
 *   2. POST /umbraco/surface/UmbracoLogin/HandleLogin with token + credentials
 *   3. Response JSON { success: true, redirectUrl } → session cookies are set
 *
 * No Puppeteer, no Chromium, ~0MB RAM. Login takes <1s vs ~10s with browser.
 */

import * as cheerio from 'cheerio';
import { curlService } from '../../../shared/services/curl.service.js';
import { loginSavageWhitten } from '../../../shared/services/http-auth/index.js';
import type { PackData } from '../../../shared/services/pack-parser/index.js';
import type { SupplierCredentials } from '../../../shared/services/vault.service.js';
import { BaseScraper } from '../../scraping/base.scraper.js';
import type {
  ProductBatchSaveCallback,
  ScrapedProduct,
  StreamingScrapeStats,
} from '../../scraping/scraping.types.js';
import { extractSWPackData } from './savage-whitten.pack-extractor.js';

const CONFIG = {
  baseUrl: 'https://www.savageandwhitten.com',
  loginUrl: 'https://www.savageandwhitten.com/login',
  loginEndpoint: '/umbraco/surface/UmbracoLogin/HandleLogin',
  pageSize: 300,

  categories: [104, 100, 102, 99, 101, 103, 106, 108],
} as const;

interface SWRawProduct {
  sku: string | null;
  name: string | null;
  price: string | null;
  unitSize: string | null;
  availability: string | null;
  ean: string | null;
  imageUrl: string | null;
  productUrl: string | null;
  /**
   * Umbraco node id (S&W's internal ProductId). Required by the basket API
   * `quickAddItems[n][ProductId]` field — without it every item is rejected
   * as "invalid product". Distinct from `sku` (the human-facing productCode).
   */
  internalProductId: string | null;
  pack: PackData;
}

export class SavageWhittenScraper extends BaseScraper {
  readonly supplierName = 'Savage & Whitten';
  readonly name = 'Savage & Whitten';
  readonly baseUrl = CONFIG.baseUrl;

  private sessionCookies = '';

  /**
   * No browser needed — override to skip Puppeteer initialization entirely.
   */
  async initialize(): Promise<void> {
    // No-op: pure HTTP scraper, no browser to create.
  }

  /**
   * Login via pure HTTP POST — delegates to the shared http-auth module
   * so ordering uses the exact same flow.
   */
  async login(credentials: SupplierCredentials): Promise<void> {
    const session = await loginSavageWhitten(credentials);
    this.sessionCookies = session.cookies;
  }

  private curlOpts(extra?: Parameters<typeof curlService.fetch>[1]) {
    return { ...extra, supplierKey: this.supplierName };
  }

  async scrapeProducts(onBatchReady?: ProductBatchSaveCallback): Promise<StreamingScrapeStats> {
    if (!this.sessionCookies) {
      throw new Error('No session cookies. Call login() first.');
    }

    const stats: StreamingScrapeStats = {
      totalFetched: 0,
      totalMatched: 0,
      totalSaved: 0,
      totalSkipped: 0,
      batchCount: 0,
      failedBatches: 0,
      failedBatchDetails: [],
    };

    this.log.info('Starting product scrape via curl-impersonate');

    const CONCURRENT_CATEGORIES = 3;

    try {
      // Scrape categories in parallel batches of CONCURRENT_CATEGORIES
      for (let i = 0; i < CONFIG.categories.length; i += CONCURRENT_CATEGORIES) {
        const batch = CONFIG.categories.slice(i, i + CONCURRENT_CATEGORIES);

        const batchResults = await Promise.all(batch.map((catId) => this.scrapeCategory(catId)));

        for (let j = 0; j < batchResults.length; j++) {
          const products = batchResults[j];
          const categoryId = batch[j];

          if (products.length > 0 && onBatchReady) {
            stats.batchCount++;
            const result = await onBatchReady(products);
            stats.totalFetched += products.length;
            stats.totalMatched += result.matchedCount;
            stats.totalSaved += result.savedCount;
            stats.totalSkipped += result.skippedCount;
            if (result.error) {
              stats.failedBatches++;
              stats.failedBatchDetails.push({ batchIndex: stats.batchCount, error: result.error });
            }
          } else {
            stats.totalFetched += products.length;
          }

          this.log.debug({ categoryId, products: products.length }, 'Category scraped');
        }
      }

      this.log.info(
        { totalFetched: stats.totalFetched, totalSaved: stats.totalSaved },
        'Scrape complete'
      );
      return stats;
    } catch (error) {
      this.log.error({ err: error }, 'Error during scrape');
      throw error;
    }
  }

  private async scrapeCategory(categoryId: number): Promise<ScrapedProduct[]> {
    const products: ScrapedProduct[] = [];

    // Fetch first page to get total pages
    const firstUrl = `${CONFIG.baseUrl}/ambient-products/${categoryId}/?pagesize=${CONFIG.pageSize}&page=1`;
    const firstRes = await curlService.fetch(
      firstUrl,
      this.curlOpts({
        cookies: this.sessionCookies,
        headers: {
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
        },
      })
    );

    if (firstRes.statusCode !== 200) {
      this.log.warn({ categoryId, status: firstRes.statusCode }, 'Non-200 response');
      return products;
    }

    let $ = cheerio.load(firstRes.body);
    const totalPages = this.getTotalPages($);

    // Parse first page
    const firstPageProducts = this.parseProducts($);
    for (const raw of firstPageProducts) {
      const product = this.transformProduct(raw);
      if (product) products.push(product);
    }

    // Fetch remaining pages
    for (let page = 2; page <= totalPages; page++) {
      const url = `${CONFIG.baseUrl}/ambient-products/${categoryId}/?pagesize=${CONFIG.pageSize}&page=${page}`;

      const response = await curlService.fetch(
        url,
        this.curlOpts({
          cookies: this.sessionCookies,
          headers: {
            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'accept-language': 'en-US,en;q=0.9',
          },
        })
      );

      if (response.statusCode !== 200) break;

      $ = cheerio.load(response.body);
      const pageProducts = this.parseProducts($);

      if (pageProducts.length === 0) break;

      for (const raw of pageProducts) {
        const product = this.transformProduct(raw);
        if (product) products.push(product);
      }

      await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));
    }

    return products;
  }

  private getTotalPages($: cheerio.CheerioAPI): number {
    const val = $('#desktopPageCount').val();
    if (typeof val === 'string') {
      const parsed = Number.parseInt(val, 10);
      return Number.isNaN(parsed) ? 1 : parsed;
    }
    return 1;
  }

  private parseProducts($: cheerio.CheerioAPI): SWRawProduct[] {
    const products: SWRawProduct[] = [];

    $('#js-resultsContainer form.c-product-item-card').each((_, element) => {
      const el = $(element);

      const sku =
        (el.find('input[name="productCode"]').val() as string) ||
        el.find('p.u-align-right._product-code').text().trim() ||
        null;

      const name = el.find('p._product-name').text().trim() || null;

      // Price: get text but exclude <span> children
      let price: string | null = null;
      const priceEl = el.find('p._product-price');
      if (priceEl.length) {
        const clone = priceEl.clone();
        clone.find('span').remove();
        price = clone.text().trim() || null;
      }

      const unitSize =
        el.find('div._product-info div.o-grid p.o-grid__item._product-size').text().trim() || null;

      const availability =
        el.find('div._product-info p.u-text-small.u-c-red2').text().trim() ||
        el.find('div._product-info p.u-text-small.u-c-sw-yellow').text().trim() ||
        null;

      const imageUrl = el.find('a[href^="/product-detail"] img').attr('src') ?? null;
      const productUrl = el.find('a[href^="/product-detail"]').attr('href') ?? null;

      // EAN from image URL pattern: /ProductImages/{EAN}_{SKU}_{hash}.png
      let ean: string | null = null;
      if (imageUrl) {
        const eanMatch = imageUrl.match(/\/ProductImages\/(\d{8,14})_/);
        ean = eanMatch?.[1] ?? null;
      }

      // Umbraco node id — basket API requires this as `ProductId`.
      // Hidden input inside the form: <input name="productId" value="258">
      const internalProductId = (el.find('input[name="productId"]').val() as string) || null;

      // Pack data (unit cost, pack count, pack unit size) — shared pure extractor.
      const pack = extractSWPackData($, el);

      products.push({
        sku,
        name,
        price,
        unitSize,
        availability,
        ean,
        imageUrl,
        productUrl,
        internalProductId,
        pack,
      });
    });

    return products;
  }

  private transformProduct(raw: SWRawProduct): ScrapedProduct | null {
    if (!raw.ean || !raw.price) return null;

    const price = this.parsePrice(raw.price);
    if (price <= 0) return null;

    const metadata: Record<string, unknown> = {};
    if (raw.imageUrl) metadata.imageUrl = this.resolveUrl(raw.imageUrl);
    if (raw.productUrl) metadata.productUrl = this.resolveUrl(raw.productUrl);
    if (raw.internalProductId) metadata.internal_product_id = raw.internalProductId;
    if (raw.pack.unitCostInclVat !== null) metadata.unit_cost_incl_vat = raw.pack.unitCostInclVat;
    if (raw.pack.packCount !== null) metadata.pack_count = raw.pack.packCount;
    if (raw.pack.packUnitSize) metadata.pack_unit_size = raw.pack.packUnitSize;

    return {
      supplierProductCode: raw.sku ?? '',
      eanCode: raw.ean.replace(/\D/g, ''),
      name: raw.name ?? 'Unknown Product',
      price,
      unitSize: raw.unitSize ?? undefined,
      availability: this.mapAvailability(raw.availability),
      metadata,
    };
  }

  private resolveUrl(url: string): string {
    if (url.startsWith('http')) return url;
    return `${CONFIG.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  private mapAvailability(
    str: string | null
  ): 'available' | 'out_of_stock' | 'discontinued' | 'unknown' {
    if (!str) return 'available'; // Default when missing
    const lower = str.toLowerCase();
    if (lower.includes('out of stock') || lower.includes('unavailable')) return 'out_of_stock';
    if (lower.includes('discontinued') || lower.includes('delisted')) return 'discontinued';
    return 'available';
  }

  /**
   * Health check via HTTP — no browser needed.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const res = await curlService.fetch(CONFIG.baseUrl, this.curlOpts());
      return res.statusCode === 200;
    } catch {
      return false;
    }
  }

  /**
   * Cleanup — no browser to close, just clear cookies.
   */
  async cleanup(): Promise<void> {
    this.sessionCookies = '';
  }
}
