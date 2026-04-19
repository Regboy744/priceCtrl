/**
 * O'Reillys Wholesale Scraper
 *
 * Pure curl-impersonate approach — NO browser at all:
 * - HTTP POST to /login.asp for authentication (classic ASP form)
 * - curl-impersonate + cheerio for product scraping
 *
 * Login flow:
 *   1. GET /mainlogin.asp → collect ASP session + Cloudflare cookies
 *   2. POST /login.asp with username & password + cookies from step 1
 *   3. Response sets authenticated session cookie → used for all scraping
 *
 * No Puppeteer, no Chromium, ~0MB RAM. Login takes <1s vs ~10s with browser.
 */

import * as cheerio from 'cheerio';
import { curlService } from '../../../shared/services/curl.service.js';
import { loginOreillys } from '../../../shared/services/http-auth/index.js';
import type { SupplierCredentials } from '../../../shared/services/vault.service.js';
import { BaseScraper } from '../../scraping/base.scraper.js';
import type {
  ProductBatchSaveCallback,
  ScrapedProduct,
  StreamingScrapeStats,
} from '../../scraping/scraping.types.js';
import { OREILLYS_CONFIG } from './oreillys.config.js';
import { extractOreillysPackData } from './oreillys.pack-extractor.js';
import { transformToScrapedProduct } from './oreillys.parser.js';
import type { OreillysRawProduct } from './oreillys.types.js';

export class OreillyScraper extends BaseScraper {
  readonly supplierName = "O'Reillys Wholesale";
  readonly name = "O'Reillys Wholesale";
  readonly baseUrl = OREILLYS_CONFIG.baseUrl;

  /** Session cookies obtained via HTTP login */
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
    const session = await loginOreillys(credentials);
    this.sessionCookies = session.cookies;
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

    const CONCURRENT_DEPTS = 3;

    try {
      // Scrape departments in parallel batches of CONCURRENT_DEPTS
      for (let i = 0; i < OREILLYS_CONFIG.departments.length; i += CONCURRENT_DEPTS) {
        const batch = OREILLYS_CONFIG.departments.slice(i, i + CONCURRENT_DEPTS);

        const batchResults = await Promise.all(batch.map((dept) => this.scrapeDepartment(dept)));

        for (let j = 0; j < batchResults.length; j++) {
          const deptProducts = batchResults[j];
          const dept = batch[j];

          if (deptProducts.length > 0 && onBatchReady) {
            stats.batchCount++;
            const result = await onBatchReady(deptProducts);
            stats.totalFetched += deptProducts.length;
            stats.totalMatched += result.matchedCount;
            stats.totalSaved += result.savedCount;
            stats.totalSkipped += result.skippedCount;
            if (result.error) {
              stats.failedBatches++;
              stats.failedBatchDetails.push({ batchIndex: stats.batchCount, error: result.error });
            }
          } else {
            stats.totalFetched += deptProducts.length;
          }

          this.log.info(
            { department: dept, products: deptProducts.length, totalSaved: stats.totalSaved },
            'Department scraped'
          );
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

  /**
   * Scrape all pages for a single department.
   */
  private async scrapeDepartment(deptCode: number): Promise<ScrapedProduct[]> {
    const products: ScrapedProduct[] = [];

    // Fetch first page to determine total pages
    const firstUrl = `${OREILLYS_CONFIG.baseUrl}/products/gridlist.asp?DeptCode=${deptCode}&page=1`;
    const firstRes = await curlService.fetch(firstUrl, {
      cookies: this.sessionCookies,
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
      },
    });

    if (firstRes.statusCode !== 200) {
      this.log.warn({ deptCode, status: firstRes.statusCode }, 'Non-200 on first page');
      return products;
    }

    let $ = cheerio.load(firstRes.body);
    const totalPages = this.getTotalPages($);

    // Parse first page
    for (const raw of this.parseProductsFromHtml($)) {
      const product = transformToScrapedProduct(raw);
      if (product) products.push(product);
    }

    // Fetch remaining pages
    for (let page = 2; page <= totalPages; page++) {
      const url = `${OREILLYS_CONFIG.baseUrl}/products/gridlist.asp?DeptCode=${deptCode}&page=${page}`;

      const response = await curlService.fetch(url, {
        cookies: this.sessionCookies,
        headers: {
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
        },
      });

      if (response.statusCode !== 200) break;

      $ = cheerio.load(response.body);
      const pageProducts = this.parseProductsFromHtml($);
      if (pageProducts.length === 0) break;

      for (const raw of pageProducts) {
        const product = transformToScrapedProduct(raw);
        if (product) products.push(product);
      }

      await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));
    }

    return products;
  }

  /**
   * Get total pages by finding highest page number in pagination links.
   */
  private getTotalPages($: cheerio.CheerioAPI): number {
    let maxPage = 1;
    $('a[href*="page="]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      const match = href.match(/page=(\d+)/);
      if (match?.[1]) {
        const num = Number.parseInt(match[1], 10);
        if (num > maxPage) maxPage = num;
      }
    });
    return maxPage;
  }

  /**
   * Parse products from HTML using cheerio.
   * Mirrors the extraction logic from oreillys.definition.ts.
   */
  private parseProductsFromHtml($: cheerio.CheerioAPI): OreillysRawProduct[] {
    const products: OreillysRawProduct[] = [];

    $('table.ProductBox').each((_, element) => {
      const el = $(element);

      // SKU from hidden input
      const sku = (el.find('input[name="product_code"]').val() as string) || null;

      // Name from product details link in td with height:50px
      let name: string | null = null;
      el.find('td.ProdDetails[colspan="2"]').each((_, td) => {
        const style = $(td).attr('style') ?? '';
        if (style.includes('height:50px') || style.includes('height: 50px')) {
          const link = $(td).find('a');
          if (link.length) {
            name = link.text().trim() || null;
          }
        }
      });

      // Price: prefer PromoPrice over StdPrice
      const promoPrice = el.find('.PromoPrice').text().trim();
      const stdPrice = el.find('.StdPrice').text().trim();
      const price = promoPrice || stdPrice || null;

      // VAT rate from td.ProdDetails containing "VAT"
      let vatRate: string | null = null;
      el.find('td.ProdDetails').each((_, td) => {
        const text = $(td).text();
        if (text.includes('VAT')) {
          vatRate = text.trim();
        }
      });

      // EAN from image src pattern: /{EAN}t.jpg
      const imgSrc = el.find('img[id="prod"]').attr('src') ?? '';
      const eanMatch = imgSrc.match(/(\d{5,14})t\.jpg/);
      const ean = eanMatch?.[1] ?? null;

      // Pack data — shared pure extractor.
      const pack = extractOreillysPackData($, el);

      products.push({
        name,
        price,
        sku,
        ean,
        availability: el.find('.OKStatus, .NoStock, .DueIn').first().text().trim() || null,
        unitSize: null,
        vatRate,
        productUrl: null,
        pack,
      });
    });

    return products;
  }

  /**
   * Health check via HTTP — no browser needed.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const res = await curlService.fetch(OREILLYS_CONFIG.baseUrl);
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
