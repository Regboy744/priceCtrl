/**
 * Barry Group Scraper
 *
 * Pure curl-impersonate approach — NO browser at all:
 * - HTTP POST to /login.asp for authentication (classic ASP form)
 * - curl-impersonate + cheerio for product scraping
 *
 * Login flow:
 *   1. GET / → collect ASP session + cookies
 *   2. POST /login.asp with username & password + cookies from step 1
 *   3. Authenticated session cookie → used for all scraping
 *
 * Barry Group has two phases (Ambient dept=6, Chilled dept=35),
 * each with multiple product groups. Department is set via a setup URL,
 * then product pages are fetched via curl.
 *
 * No Puppeteer, no Chromium, ~0MB RAM. Login takes <1s vs ~10s with browser.
 */

import * as cheerio from 'cheerio';
import { curlService } from '../../../shared/services/curl.service.js';
import { loginBarryGroup } from '../../../shared/services/http-auth/index.js';
import { type PackData, parseEuroAmount } from '../../../shared/services/pack-parser/index.js';
import type { SupplierCredentials } from '../../../shared/services/vault.service.js';
import { BaseScraper } from '../../scraping/base.scraper.js';
import type {
  ProductBatchSaveCallback,
  ScrapedProduct,
  StreamingScrapeStats,
} from '../../scraping/scraping.types.js';
import { extractBarryPackData } from './barry-group.pack-extractor.js';

const CONFIG = {
  baseUrl: 'https://ind.barrys.ie',
  loginUrl: 'https://ind.barrys.ie/',
  loginEndpoint: '/login.asp',
  pageSize: 200, // Higher = fewer requests. ASP site respects ItemPP param.

  phases: [
    {
      name: 'Ambient',
      setupUrl: '/products/SetDetails.asp?Dept=6',
      // Ambient tolerates 3 parallel categories — Cloudflare's `__cf_bm`
      // gate on this section is lenient.
      concurrency: 6,
      categories: [
        { department: 6, prodgroup: 10 },
        { department: 6, prodgroup: 14 },
        { department: 6, prodgroup: 15 },
        { department: 6, prodgroup: 16 },
        { department: 6, prodgroup: 21 },
        { department: 6, prodgroup: 25 },
        { department: 6, prodgroup: 27 },
        { department: 6, prodgroup: 28 },
        { department: 6, prodgroup: 29 },
        { department: 6, prodgroup: 13 },
        { department: 6, prodgroup: 26 },
      ],
    },
    {
      name: 'Chilled',
      setupUrl: '/products/SetDetailsFV.asp?Dept=35',
      // Chilled's `__cf_bm` gate drops the 3rd concurrent gridlist.asp with
      // curl code 28 (timeout). Sequential — catalog is small, no speed loss.
      concurrency: 1,
      categories: [
        { department: 35, prodgroup: 2 },
        { department: 35, prodgroup: 3 },
        { department: 35, prodgroup: 4 },
        { department: 35, prodgroup: 5 },
        { department: 35, prodgroup: 6 },
        { department: 35, prodgroup: 7 },
        { department: 35, prodgroup: 8 },
        { department: 35, prodgroup: 9 },
      ],
    },
  ],
} as const;

interface BarryRawProduct {
  sku: string | null;
  name: string | null;
  price: string | null;
  vatRate: string | null;
  ean: string | null;
  pack: PackData;
}

export class BarryGroupScraper extends BaseScraper {
  readonly supplierName = 'Barry Group';
  readonly name = 'Barry Group';
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
    const session = await loginBarryGroup(credentials);
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

    try {
      for (const phase of CONFIG.phases) {
        this.log.info({ phase: phase.name, concurrency: phase.concurrency }, 'Starting phase');

        // Hit the dept setup URL to switch the server-side ASP session
        // (SetDetails.asp for Ambient, SetDetailsFV.asp for Chilled), then
        // pause 1s so the session state commits before we start fetching
        // product pages. Too short a pause — especially combined with
        // parallel heavy gridlist.asp calls — causes curl code 28 / HTTP 000
        // from Cloudflare.
        if (phase.setupUrl) {
          await curlService.fetch(`${CONFIG.baseUrl}${phase.setupUrl}`, {
            cookies: this.sessionCookies,
          });
          await new Promise((r) => setTimeout(r, 1000));
        }

        // Scrape categories in parallel batches sized per-phase.
        for (let i = 0; i < phase.categories.length; i += phase.concurrency) {
          const batch = phase.categories.slice(i, i + phase.concurrency);
          const batchResults = await Promise.all(
            batch.map((cat) => this.scrapeCategory(cat.department, cat.prodgroup))
          );

          for (let j = 0; j < batchResults.length; j++) {
            const products = batchResults[j];
            const cat = batch[j];

            if (products.length > 0 && onBatchReady) {
              stats.batchCount++;
              const result = await onBatchReady(products);
              stats.totalFetched += products.length;
              stats.totalMatched += result.matchedCount;
              stats.totalSaved += result.savedCount;
              stats.totalSkipped += result.skippedCount;
              if (result.error) {
                stats.failedBatches++;
                stats.failedBatchDetails.push({
                  batchIndex: stats.batchCount,
                  error: result.error,
                });
              }
            } else {
              stats.totalFetched += products.length;
            }

            this.log.debug(
              { dept: cat.department, prodgroup: cat.prodgroup, products: products.length },
              'Category scraped'
            );
          }
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

  private async scrapeCategory(department: number, prodgroup: number): Promise<ScrapedProduct[]> {
    const products: ScrapedProduct[] = [];

    // Fetch first page to determine total pages
    const firstUrl = `${CONFIG.baseUrl}/products/gridlist.asp?department=${department}&prodgroup=${prodgroup}&ItemPP=${CONFIG.pageSize}&page=1`;
    const firstRes = await curlService.fetch(firstUrl, {
      cookies: this.sessionCookies,
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
      },
    });

    if (firstRes.statusCode !== 200) return products;

    let $ = cheerio.load(firstRes.body);
    const totalPages = this.getTotalPages($);

    // Parse first page, backfill missing EANs from details.asp, then transform.
    const firstCards = this.parseProducts($);
    await this.enrichMissingEans(firstCards);
    for (const raw of firstCards) {
      const product = this.transformProduct(raw);
      if (product) products.push(product);
    }

    // Fetch remaining pages
    for (let page = 2; page <= totalPages; page++) {
      const url = `${CONFIG.baseUrl}/products/gridlist.asp?department=${department}&prodgroup=${prodgroup}&ItemPP=${CONFIG.pageSize}&page=${page}`;

      const response = await curlService.fetch(url, {
        cookies: this.sessionCookies,
        headers: {
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
        },
      });

      if (response.statusCode !== 200) break;

      $ = cheerio.load(response.body);
      const rawProducts = this.parseProducts($);
      if (rawProducts.length === 0) break;

      // Same details.asp backfill as page 1.
      await this.enrichMissingEans(rawProducts);
      for (const raw of rawProducts) {
        const product = this.transformProduct(raw);
        if (product) products.push(product);
      }

      await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));
    }

    return products;
  }

  /**
   * Fill in `ean` for cards whose listing image didn't carry one by fetching
   * the product details page. `details.asp?product_code={code}` renders a
   * clean table with an explicit `EAN Code` row — the only place on Barry
   * where the true EAN is guaranteed for older products.
   *
   * Mutates `cards` in place. Runs in small parallel batches with a short
   * inter-batch pause so Barry/Cloudflare don't flag the burst.
   */
  private async enrichMissingEans(cards: BarryRawProduct[]): Promise<void> {
    const needsEan = cards.filter((c) => !c.ean && c.sku);
    if (needsEan.length === 0) return;

    const CONCURRENCY = 3;
    const INTER_BATCH_DELAY_MS = 200;

    for (let i = 0; i < needsEan.length; i += CONCURRENCY) {
      const batch = needsEan.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (card) => {
          if (!card.sku) return;
          card.ean = await this.fetchEanFromDetails(card.sku);
        })
      );
      if (i + CONCURRENCY < needsEan.length) {
        await new Promise((r) => setTimeout(r, INTER_BATCH_DELAY_MS));
      }
    }
  }

  /**
   * Fetch one product details page and pull its `EAN Code` row.
   * Returns null if the page doesn't render EAN (no barcode assigned) or
   * the request fails.
   */
  private async fetchEanFromDetails(productCode: string): Promise<string | null> {
    const url = `${CONFIG.baseUrl}/products/details.asp?product_code=${encodeURIComponent(productCode)}`;

    try {
      const res = await curlService.fetch(url, {
        cookies: this.sessionCookies,
        headers: {
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
        },
      });
      if (res.statusCode !== 200) return null;

      const $ = cheerio.load(res.body);
      let ean: string | null = null;
      $('td.dcell').each((_, el) => {
        if ($(el).text().trim() === 'EAN Code') {
          const value = $(el).next('td.lcell').text().trim();
          if (/^\d{5,14}$/.test(value)) ean = value;
          return false; // break
        }
        return undefined;
      });
      return ean;
    } catch (err) {
      this.log.warn({ productCode, err }, 'details.asp fetch failed');
      return null;
    }
  }

  /**
   * Get total pages by finding highest page number in pagination links.
   */
  private getTotalPages($: cheerio.CheerioAPI): number {
    let maxPage = 1;
    $('a[href*="page="]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      const match = href.match(/page=(\d+)/i);
      if (match?.[1]) {
        const num = Number.parseInt(match[1], 10);
        if (num > maxPage) maxPage = num;
      }
    });
    return maxPage;
  }

  /**
   * Parse gridlist.asp product cards.
   *
   * Barry has two catalog views: the simpler list.asp (flat table, no UCIV)
   * and gridlist.asp (card grid with full pricing metadata). We use gridlist
   * so `unit_cost_incl_vat` + pack data are always available — see the
   * fixture at `./listing.html` and the `extractBarryPackData` extractor.
   *
   * VAT Rate is commented out in the gridlist template — default to 0;
   * ranking comparison uses UCIV (VAT-incl) so the missing VAT doesn't
   * affect correctness.
   */
  private parseProducts($: cheerio.CheerioAPI): BarryRawProduct[] {
    const products: BarryRawProduct[] = [];

    $('div.GridCell').each((_, element) => {
      const card = $(element);

      // Product code (hidden input — same selector as list.asp).
      const sku = (card.find('input[name="product_code"]').val() as string | undefined) ?? null;

      // Product name lives inside the bold tag under .ProdDesc's prodDetails link.
      const name = card.find('div.ProdDesc a[onclick^="prodDetails"] b').text().trim() || null;

      // Case price: "CASE PRICE €14.99" — parse the euro amount.
      const price = card.find('div.ProdPriceCS').text().trim() || null;

      // EAN: only trust the canonical image CDN — there the filename IS the
      // real EAN-13 (`ProductImages.swords.apteancloud.com/{EAN}t.jpg`).
      // The fallback `beacon.barrys.ie/~uldir/{product_code}t.jpg` contains
      // the SKU, not an EAN — matching that would silently poison downstream
      // lookups. For those, leave `ean` null and let the details-page
      // fallback (see `fetchEanFromDetails`) recover it.
      const imgSrc = card.find('img#prod').attr('src') ?? '';
      let ean: string | null = null;
      if (imgSrc.includes('ProductImages.swords.apteancloud.com')) {
        const eanMatch = imgSrc.match(/(\d{5,14})t\.jpg/);
        ean = eanMatch?.[1] ?? null;
      }

      // Pack data — shared extractor, pure function.
      const pack = extractBarryPackData($, card);

      products.push({ sku, name, price, vatRate: null, ean, pack });
    });

    return products;
  }

  private transformProduct(raw: BarryRawProduct): ScrapedProduct | null {
    if (!raw.ean || !raw.price) return null;

    // `raw.price` on the gridlist view is "CASE PRICE €14.99" — the default
    // BaseScraper.parsePrice strips currency + spaces and chokes on the label.
    // Use the shared euro-number parser which regex-extracts the amount from
    // any surrounding text.
    const price = parseEuroAmount(raw.price) ?? 0;
    if (price <= 0) return null;

    // Stash pack metadata so scraping.service can persist it to supplier_products.
    // Same channel `internal_product_id` uses — no service-layer surgery needed.
    const metadata: Record<string, unknown> = {};
    if (raw.pack.unitCostInclVat !== null) metadata.unit_cost_incl_vat = raw.pack.unitCostInclVat;
    if (raw.pack.packCount !== null) metadata.pack_count = raw.pack.packCount;
    if (raw.pack.packUnitSize) metadata.pack_unit_size = raw.pack.packUnitSize;

    return {
      supplierProductCode: raw.sku ?? '',
      eanCode: raw.ean.replace(/\D/g, ''),
      name: raw.name ?? 'Unknown Product',
      price,
      vatRate: this.extractVatRate(raw.vatRate),
      availability: 'available',
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };
  }

  private extractVatRate(vatStr: string | null): number {
    if (!vatStr) return 0;
    const match = vatStr.match(/(\d+(?:\.\d+)?)/);
    const pct = match ? Number.parseFloat(match[1]) : 0;
    return pct / 100; // Convert to decimal
  }

  /**
   * Health check via HTTP — no browser needed.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const res = await curlService.fetch(CONFIG.baseUrl);
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
