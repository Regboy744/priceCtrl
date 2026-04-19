import { randomUUID } from 'node:crypto';
import { getServiceClient } from '../../shared/database/supabase.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';
import { createJobLogger, createLogger } from '../../shared/services/logger.service.js';
import { vaultService } from '../../shared/services/vault.service.js';
import type { InsertTables, Tables } from '../../shared/types/database.types.js';
import { getAllScrapers, getScraper, getScraperInfo } from './scraping.registry.js';
import type {
  BatchSaveResult,
  JobStatus,
  ProductBatchSaveCallback,
  ScrapeJobConfig,
  ScrapeResult,
  ScrapedProduct,
  ScrapingJob,
  ScrapingMode,
  ScrapingStats,
  StreamingScrapeStats,
} from './scraping.types.js';

type MasterProduct = Tables<'master_products'>;
type SupplierProductInsert = InsertTables<'supplier_products'>;
type SupplierCompanyPriceInsert = InsertTables<'supplier_company_prices'>;
type CompanySupplierSettingsRow = Tables<'company_supplier_settings'> & {
  special_pricing_enabled?: boolean | null;
};

const log = createLogger('ScrapingService');
const masterProductCacheLog = createLogger('MasterProductCache');

/**
 * Result of saving products (for logging/reporting)
 */
interface SaveProductsResult {
  mode: ScrapingMode;
  savedCount: number;
  deltasFound?: number;
}

interface BaselineInfo {
  hasBaseline: boolean;
  companyId: string | null;
}

interface SupplierScrapePlan {
  supplierId: string;
  baselineCompanyId: string;
  forceBaseline: boolean;
  specialPricingCompanyIds: string[];
}

// ============ Master Product Cache ============

/**
 * Cache for master product lookups, scoped to a single supplier.
 * Pre-loads known products for the supplier (EAN → master_product_id mapping),
 * then lazily loads new products as they are encountered.
 *
 * This reduces database queries during streaming scrapes:
 * - Known products: instant cache lookup
 * - New products: batched query, results added to cache
 */
class MasterProductCache {
  private cache: Map<string, string> = new Map(); // ean_code → master_product_id
  private initialized = false;
  private supabase = getServiceClient();

  constructor(private supplierId: string) {}

  /**
   * Initialize cache with supplier's known products.
   * Queries master_products joined with supplier_products to get only
   * the EANs that this supplier has previously sold.
   *
   * For baseline mode (no existing products), cache starts empty
   * and will be populated lazily during the scrape.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const cacheLog = masterProductCacheLog.child({ supplierId: this.supplierId });
    cacheLog.debug('Initializing cache');

    try {
      // Get all master product IDs that this supplier has products for
      // Use pagination to fetch ALL products (Supabase has default row limit)
      const FETCH_BATCH_SIZE = 5000;
      let offset = 0;
      let hasMore = true;
      const masterProductIds: string[] = [];

      while (hasMore) {
        const { data: supplierProductIds, error: spError } = await this.supabase
          .from('supplier_products')
          .select('master_product_id')
          .eq('supplier_id', this.supplierId)
          .range(offset, offset + FETCH_BATCH_SIZE - 1);

        if (spError) {
          cacheLog.error({ err: spError }, 'Error fetching supplier product IDs');
          throw spError;
        }

        if (supplierProductIds && supplierProductIds.length > 0) {
          type SupplierProductRow = { master_product_id: string };
          for (const sp of supplierProductIds as SupplierProductRow[]) {
            masterProductIds.push(sp.master_product_id);
          }
          hasMore = supplierProductIds.length === FETCH_BATCH_SIZE;
          offset += FETCH_BATCH_SIZE;
        } else {
          hasMore = false;
        }
      }

      if (masterProductIds.length === 0) {
        cacheLog.debug('No existing products for supplier (baseline mode)');
        this.initialized = true;
        return;
      }

      cacheLog.debug(
        { masterProductIds: masterProductIds.length },
        'Fetched supplier products, looking up EAN codes'
      );

      // Get EAN codes for these master products in batches
      // Note: Batch size is limited to avoid URL length limits with .in() queries
      // Each UUID is ~36 chars, so 200 UUIDs ≈ 7.2KB which is safe for most servers
      const BATCH_SIZE = 200;

      for (let i = 0; i < masterProductIds.length; i += BATCH_SIZE) {
        const batch = masterProductIds.slice(i, i + BATCH_SIZE);

        const { data: masterProducts, error: mpError } = await this.supabase
          .from('master_products')
          .select('id, ean_code')
          .in('id', batch);

        if (mpError) {
          cacheLog.error({ err: mpError }, 'Error fetching master products');
          throw mpError;
        }

        if (masterProducts) {
          type MasterProductRow = { id: string; ean_code: string | null };
          for (const mp of masterProducts as MasterProductRow[]) {
            if (mp.ean_code) {
              this.cache.set(mp.ean_code, mp.id);
            }
          }
        }
      }

      cacheLog.debug({ cacheSize: this.cache.size }, 'Cache initialized');
      this.initialized = true;
    } catch (error) {
      cacheLog.error({ err: error }, 'Cache initialization failed');
      // Allow to proceed with empty cache - will query per batch
      this.initialized = true;
    }
  }

  /**
   * Look up master product IDs for a batch of EAN codes.
   * First checks the cache, then queries the database for unknown EANs.
   * New mappings are added to the cache for future lookups.
   *
   * @param eanCodes - Array of EAN codes to look up
   * @returns Map of ean_code → master_product_id for found products
   */
  async lookupBatch(eanCodes: string[]): Promise<Map<string, string>> {
    const cacheLog = masterProductCacheLog.child({ supplierId: this.supplierId });
    const result = new Map<string, string>();
    const unknownEans: string[] = [];

    // Check cache first
    for (const ean of eanCodes) {
      if (!ean) continue;

      const cached = this.cache.get(ean);
      if (cached) {
        result.set(ean, cached);
      } else {
        unknownEans.push(ean);
      }
    }

    // Query DB for unknown EANs IN BATCHES
    if (unknownEans.length > 0) {
      const CHUNK_SIZE = 200; // Same as initialize() to avoid header overflow

      for (let i = 0; i < unknownEans.length; i += CHUNK_SIZE) {
        const chunk = unknownEans.slice(i, i + CHUNK_SIZE);

        const { data, error } = await this.supabase
          .from('master_products')
          .select('id, ean_code')
          .in('ean_code', chunk);
        if (error) {
          cacheLog.error({ err: error, chunkSize: chunk.length }, 'Error looking up EAN chunk');
          continue; // Continue with other chunks instead of returning early
        }
        if (data) {
          type MasterProductRow = { id: string; ean_code: string | null };
          for (const mp of data as MasterProductRow[]) {
            if (mp.ean_code) {
              this.cache.set(mp.ean_code, mp.id);
              result.set(mp.ean_code, mp.id);
            }
          }
        }
      }
      const fromCache = eanCodes.length - unknownEans.length;
      const fromDb = result.size - fromCache;
      const notFound = unknownEans.length - fromDb;
      cacheLog.debug(
        { requested: eanCodes.length, fromCache, fromDb, notFound },
        'Batch lookup completed'
      );
    }
    return result;
  }

  /**
   * Get cache statistics for debugging/logging.
   */
  getStats(): { cacheSize: number } {
    return { cacheSize: this.cache.size };
  }
}

/**
 * Service for orchestrating scraping operations.
 * Manages job execution, tracking, and data persistence.
 *
 * Implements baseline + delta pricing strategy:
 * - First eligible company scraped for a supplier becomes the baseline (prices in supplier_products)
 * - Only companies with special pricing enabled are scraped for deltas (supplier_company_prices)
 * - Delta comparison is keyed by master product + supplier product code to avoid pack-size mismatches
 */
class ScrapingService {
  private supabase = getServiceClient();

  // In-memory job tracking. Trade-offs of this choice:
  //   - All job state (status, result, timing) is lost on process restart.
  //     A deploy mid-scrape drops the job — /jobs list returns empty.
  //   - Does not survive horizontal scale-out: a second instance would
  //     have its own Map, and /jobs would miss the other's work. We run
  //     a single backend replica today.
  //   - If we need durability or post-mortem visibility, move this into
  //     a `scraping_jobs` Supabase table.
  private jobs: Map<string, ScrapingJob> = new Map();

  /**
   * Trigger a scraping job for a specific supplier and company.
   * Applies baseline and special pricing rules.
   *
   * @param config - Job configuration
   * @param forceBaseline - If true, forces baseline when company is the baseline
   */
  async triggerScrape(
    config: Pick<ScrapeJobConfig, 'supplierId' | 'companyId' | 'isManual'>,
    forceBaseline = false
  ): Promise<ScrapingJob> {
    const scraper = getScraper(config.supplierId);

    if (!scraper) {
      throw new NotFoundError(`No scraper found for supplier: ${config.supplierId}`);
    }

    const plan = await this.buildSupplierScrapePlan(config.supplierId);
    if (!plan) {
      throw new NotFoundError(`No active credentials found for supplier ${config.supplierId}`);
    }

    const isBaselineCompany = plan.baselineCompanyId === config.companyId;
    const isSpecialPricingCompany = plan.specialPricingCompanyIds.includes(config.companyId);

    if (!isBaselineCompany && !isSpecialPricingCompany) {
      throw new BadRequestError(
        `Company ${config.companyId} is not eligible for supplier ${config.supplierId} scraping (special pricing disabled or supplier inactive)`
      );
    }

    const effectiveForceBaseline = isBaselineCompany ? plan.forceBaseline || forceBaseline : false;

    return this.enqueueScrapeJob(
      {
        supplierId: config.supplierId,
        companyId: config.companyId,
        isManual: config.isManual,
      },
      effectiveForceBaseline
    );
  }

  /**
   * Trigger scraping for all suppliers for a specific company.
   *
   * @param companyId - Company to scrape for
   * @param isManual - Whether this is a manual trigger
   */
  async triggerAllScrapers(companyId: string, isManual = false): Promise<ScrapingJob[]> {
    const scrapers = getAllScrapers();
    const jobs: ScrapingJob[] = [];

    for (const scraper of scrapers) {
      try {
        const plan = await this.buildSupplierScrapePlan(scraper.supplierId);
        if (!plan) {
          continue;
        }

        const isBaselineCompany = plan.baselineCompanyId === companyId;
        const isSpecialPricingCompany = plan.specialPricingCompanyIds.includes(companyId);

        if (!isBaselineCompany && !isSpecialPricingCompany) {
          continue;
        }

        const forceBaseline = isBaselineCompany ? plan.forceBaseline : false;

        const job = await this.enqueueScrapeJob(
          {
            supplierId: scraper.supplierId,
            companyId,
            isManual,
          },
          forceBaseline
        );

        jobs.push(job);
      } catch (error) {
        log.error(
          { supplierId: scraper.supplierId, supplier: scraper.name, err: error },
          'Failed to trigger scraper'
        );
      }
    }

    return jobs;
  }

  /**
   * Build scraping plan for a supplier (baseline + special pricing companies).
   */
  async getSupplierScrapePlan(supplierId: string): Promise<SupplierScrapePlan | null> {
    return this.buildSupplierScrapePlan(supplierId);
  }

  /**
   * Internal job enqueuing without eligibility checks (used by scheduler).
   */
  async enqueueScrapeJob(
    config: Pick<ScrapeJobConfig, 'supplierId' | 'companyId' | 'isManual'> & {
      locationId?: string;
    },
    forceBaseline = false
  ): Promise<ScrapingJob> {
    const scraper = getScraper(config.supplierId);

    if (!scraper) {
      throw new NotFoundError(`No scraper found for supplier: ${config.supplierId}`);
    }

    const fullConfig: ScrapeJobConfig = {
      supplierId: config.supplierId,
      companyId: config.companyId,
      locationId: config.locationId,
      isManual: config.isManual,
    };

    const job: ScrapingJob = {
      id: randomUUID(),
      config: fullConfig,
      status: 'pending',
      createdAt: new Date(),
    };

    (job as ScrapingJob & { forceBaseline?: boolean }).forceBaseline = forceBaseline;

    this.jobs.set(job.id, job);

    this.executeJob(job).catch((error) => {
      log.error(
        {
          jobId: job.id,
          supplierId: job.config.supplierId,
          companyId: job.config.companyId,
          err: error,
        },
        'Job execution error'
      );
    });

    return job;
  }

  /**
   * Execute a scrape job and wait for it to complete.
   * Used by the scheduler to run jobs sequentially (baseline before delta).
   */
  async executeScrapeJob(
    config: Pick<ScrapeJobConfig, 'supplierId' | 'companyId' | 'isManual'> & {
      locationId?: string;
    },
    forceBaseline = false
  ): Promise<ScrapingJob> {
    const scraper = getScraper(config.supplierId);

    if (!scraper) {
      throw new NotFoundError(`No scraper found for supplier: ${config.supplierId}`);
    }

    const fullConfig: ScrapeJobConfig = {
      supplierId: config.supplierId,
      companyId: config.companyId,
      locationId: config.locationId,
      isManual: config.isManual,
    };

    const job: ScrapingJob = {
      id: randomUUID(),
      config: fullConfig,
      status: 'pending',
      createdAt: new Date(),
    };

    (job as ScrapingJob & { forceBaseline?: boolean }).forceBaseline = forceBaseline;

    this.jobs.set(job.id, job);

    await this.executeJob(job);

    return job;
  }

  private async buildSupplierScrapePlan(supplierId: string): Promise<SupplierScrapePlan | null> {
    const credentialCandidates =
      await vaultService.getBestCredentialsByCompanyForSupplier(supplierId);

    if (credentialCandidates.length === 0) {
      return null;
    }

    const settingsByCompany = await this.getCompanySupplierSettings(supplierId);

    const eligibleCredentials = credentialCandidates.filter((cred) => {
      const settings = settingsByCompany.get(cred.company_id);
      return settings?.isActive !== false;
    });

    if (eligibleCredentials.length === 0) {
      return null;
    }

    const eligibleCompanyIds = new Set(eligibleCredentials.map((cred) => cred.company_id));
    const specialPricingCompanies = new Set(
      eligibleCredentials
        .filter((cred) => settingsByCompany.get(cred.company_id)?.specialPricingEnabled)
        .map((cred) => cred.company_id)
    );

    const baselineInfo = await this.getBaselineInfo(supplierId);

    const nonSpecialCandidates = eligibleCredentials.filter(
      (cred) => !specialPricingCompanies.has(cred.company_id)
    );

    let baselineCompanyId: string;

    if (baselineInfo.companyId && eligibleCompanyIds.has(baselineInfo.companyId)) {
      const existingBaselineHasSpecialPricing = specialPricingCompanies.has(baselineInfo.companyId);
      const preferredBaselineCandidate = existingBaselineHasSpecialPricing
        ? nonSpecialCandidates[0]
        : undefined;

      baselineCompanyId = preferredBaselineCandidate?.company_id ?? baselineInfo.companyId;
    } else {
      const baselineCandidate = nonSpecialCandidates[0] ?? eligibleCredentials[0];
      baselineCompanyId = baselineCandidate.company_id;
    }

    const forceBaseline = baselineInfo.hasBaseline && baselineInfo.companyId !== baselineCompanyId;

    const specialPricingCompanyIds = eligibleCredentials
      .map((cred) => cred.company_id)
      .filter(
        (companyId) => companyId !== baselineCompanyId && specialPricingCompanies.has(companyId)
      );

    return {
      supplierId,
      baselineCompanyId,
      forceBaseline,
      specialPricingCompanyIds,
    };
  }

  private async getBaselineInfo(supplierId: string): Promise<BaselineInfo> {
    const { data: existingProduct, error } = await this.supabase
      .from('supplier_products')
      .select('scraped_from_company_id')
      .eq('supplier_id', supplierId)
      .limit(1)
      .maybeSingle();

    if (error) {
      log.error({ supplierId, err: error }, 'Error checking baseline company');
      throw error;
    }

    if (!existingProduct) {
      return { hasBaseline: false, companyId: null };
    }

    const existing = existingProduct as { scraped_from_company_id: string | null };
    return { hasBaseline: true, companyId: existing.scraped_from_company_id };
  }

  private async getCompanySupplierSettings(
    supplierId: string
  ): Promise<Map<string, { isActive: boolean; specialPricingEnabled: boolean }>> {
    const { data, error } = await this.supabase
      .from('company_supplier_settings')
      .select('company_id, is_active, special_pricing_enabled')
      .eq('supplier_id', supplierId);

    if (error) {
      log.error({ supplierId, err: error }, 'Error fetching company supplier settings');
      throw error;
    }

    const settings = new Map<string, { isActive: boolean; specialPricingEnabled: boolean }>();

    for (const row of (data ?? []) as CompanySupplierSettingsRow[]) {
      settings.set(row.company_id, {
        isActive: row.is_active !== false,
        specialPricingEnabled: row.special_pricing_enabled === true,
      });
    }

    return settings;
  }

  /**
   * Determine the scraping mode based on existing data.
   *
   * - baseline: No products exist for this supplier yet, OR forceBaseline is true
   * - re-baseline: Products exist and this is the baseline company
   * - delta: Products exist but this is a different company
   *
   * @param supplierId - Supplier ID
   * @param companyId - Company ID being scraped
   * @param forceBaseline - If true, always returns 'baseline' (overwrites existing data)
   */
  async determineScrapingMode(
    supplierId: string,
    companyId: string,
    forceBaseline = false
  ): Promise<ScrapingMode> {
    // If forceBaseline is true, always use baseline mode
    // This will overwrite existing products via upsert
    if (forceBaseline) {
      log.info({ supplierId, companyId }, 'Force baseline mode requested');
      return 'baseline';
    }

    // Query the first supplier_product to check if baseline exists
    const { data: existingProduct, error } = await this.supabase
      .from('supplier_products')
      .select('scraped_from_company_id')
      .eq('supplier_id', supplierId)
      .limit(1)
      .maybeSingle();

    if (error) {
      log.error({ supplierId, companyId, err: error }, 'Error checking scraping mode');
      throw error;
    }

    // No products yet - this will be the baseline
    if (!existingProduct) {
      return 'baseline';
    }

    // Check if this is the baseline company
    const existing = existingProduct as { scraped_from_company_id: string | null };
    if (existing.scraped_from_company_id === companyId) {
      return 're-baseline';
    }

    // Different company - delta mode
    return 'delta';
  }

  /**
   * Execute a scraping job using streaming save approach.
   * Products are saved incrementally as batches arrive from the scraper,
   * reducing memory usage for large catalogs.
   */
  private async executeJob(job: ScrapingJob): Promise<void> {
    const scraper = getScraper(job.config.supplierId);

    if (!scraper) {
      job.status = 'failed';
      job.result = this.createFailedResult(job, 'Scraper not found');
      return;
    }

    // Get forceBaseline flag from job (set during triggerScrape)
    const forceBaseline = (job as ScrapingJob & { forceBaseline?: boolean }).forceBaseline ?? false;
    const jobLog = createJobLogger('ScrapingService', {
      jobId: job.id,
      supplier: scraper.name,
      companyId: job.config.companyId,
    });

    try {
      // Update job status
      job.status = 'running';
      job.startedAt = new Date();

      jobLog.info({ supplierId: job.config.supplierId, forceBaseline }, 'Starting scrape job');

      const credentialCandidates = await vaultService.getCredentialCandidatesForCompany(
        job.config.companyId,
        job.config.supplierId
      );

      let activeCredentials: (typeof credentialCandidates)[number] | null = null;
      let lastLoginError: Error | null = null;

      for (const credentials of credentialCandidates) {
        job.config.locationId = credentials.locationId;

        try {
          await scraper.initialize();
          await scraper.login(credentials);
          await vaultService.updateLoginStatus(credentials.id, 'success');
          activeCredentials = credentials;
          jobLog.debug(
            { credentialId: credentials.id, locationId: credentials.locationId },
            'Credential accepted'
          );
          break;
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          lastLoginError = err;
          jobLog.warn(
            { credentialId: credentials.id, locationId: credentials.locationId, err },
            'Credential login failed, trying next candidate'
          );
          await vaultService.updateLoginStatus(credentials.id, 'failed', err.message);
          try {
            await scraper.cleanup();
          } catch {
            // Ignore cleanup errors before retrying with next credential
          }
        }
      }

      if (!activeCredentials) {
        throw lastLoginError ?? new Error('No valid credentials found');
      }

      // Determine scraping mode BEFORE starting the scrape
      const mode = await this.determineScrapingMode(
        job.config.supplierId,
        job.config.companyId,
        forceBaseline
      );

      jobLog.info({ mode, forced: forceBaseline }, 'Scraping mode selected');

      // Initialize master product cache for this supplier
      const cache = new MasterProductCache(job.config.supplierId);
      await cache.initialize();

      // For delta mode, pre-load all baseline prices
      let baselinePriceMap: Map<string, number> | undefined;
      if (mode === 'delta') {
        baselinePriceMap = await this.loadBaselinePrices(job.config.supplierId);
      }

      // Create the batch save callback
      const onBatchReady = this.createBatchSaveCallback(
        job.config.supplierId,
        job.config.companyId,
        mode,
        cache,
        baselinePriceMap
      );

      // Record scrape start time for not_found detection
      const scrapeStartTime = new Date().toISOString();

      // Scrape products with streaming save
      const stats = await scraper.scrapeProducts(onBatchReady);

      // Mark products as not_found if they were not updated during this scrape
      // Only applies to baseline/re-baseline mode (full catalog scrape)
      let notFoundCount = 0;
      if (mode === 'baseline' || mode === 're-baseline') {
        // Safety check: ensure we found a reasonable number of products
        // If scrape found < 50% of previous count, skip marking to prevent false positives
        const previousCount = await this.getSupplierProductCount(job.config.supplierId);
        const foundPercentage =
          previousCount > 0 ? (stats.totalMatched / previousCount) * 100 : 100;
        const SAFETY_THRESHOLD = 50; // Minimum percentage of products that must be found

        if (previousCount > 0 && foundPercentage < SAFETY_THRESHOLD) {
          jobLog.warn(
            {
              previousCount,
              totalMatched: stats.totalMatched,
              foundPercentage: Number(foundPercentage.toFixed(1)),
              safetyThreshold: SAFETY_THRESHOLD,
            },
            'Safety check failed, skipping not_found marking'
          );
        } else {
          notFoundCount = await this.markNotFoundProducts(job.config.supplierId, scrapeStartTime);
        }
      }
      // TODO: Consider implementing not_found tracking for delta mode.
      // Delta products are company-negotiated and likely always available,
      // but may need future handling for edge cases.

      // Create success result (products array is empty - they were saved incrementally)
      const result: ScrapeResult = {
        runId: job.id,
        supplierId: job.config.supplierId,
        supplierName: scraper.name,
        locationId: job.config.locationId,
        companyId: job.config.companyId,
        scrapingMode: mode,
        status: 'completed',
        startedAt: job.startedAt,
        completedAt: new Date(),
        durationMs: Date.now() - job.startedAt.getTime(),
        productCount: stats.totalFetched,
        savedCount: stats.totalSaved,
        products: [], // Empty - products were saved incrementally to reduce memory
      };

      job.status = 'completed';
      job.completedAt = new Date();
      job.result = result;

      jobLog.info(
        {
          mode,
          totalFetched: stats.totalFetched,
          totalMatched: stats.totalMatched,
          totalSaved: stats.totalSaved,
          notFoundCount,
          failedBatches: stats.failedBatches,
          durationMs: result.durationMs,
        },
        'Scrape job completed'
      );

      // Log cache stats
      const cacheStats = cache.getStats();
      jobLog.debug({ cacheSize: cacheStats.cacheSize }, 'Cache stats');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      jobLog.error({ err: error }, 'Scrape job failed');

      job.status = 'failed';
      job.completedAt = new Date();
      job.result = this.createFailedResult(job, errorMessage);
    } finally {
      // Always cleanup
      await scraper.cleanup();
    }
  }

  // ============ Streaming Batch Save Methods ============

  /**
   * Create a batch save callback for streaming scrapes.
   * This callback is passed to the scraper and called for each batch of products.
   * It handles master product lookup (via cache) and saves to the appropriate table.
   */
  private createBatchSaveCallback(
    supplierId: string,
    companyId: string,
    mode: ScrapingMode,
    cache: MasterProductCache,
    baselinePriceMap?: Map<string, number>
  ): ProductBatchSaveCallback {
    return async (products: ScrapedProduct[]): Promise<BatchSaveResult> => {
      const batchLog = log.child({ supplierId, companyId, mode, batchSize: products.length });

      if (products.length === 0) {
        return {
          batchSize: 0,
          matchedCount: 0,
          savedCount: 0,
          skippedCount: 0,
        };
      }

      try {
        // 1. Get EAN codes from products
        const eanCodes = products.map((p) => p.eanCode).filter(Boolean);

        // 2. Lookup master product IDs using cache
        const eanToMasterProductId = await cache.lookupBatch(eanCodes);

        // 3. Filter to products that have matching master products
        const matchedProducts = products.filter((p) => eanToMasterProductId.has(p.eanCode));

        if (matchedProducts.length === 0) {
          return {
            batchSize: products.length,
            matchedCount: 0,
            savedCount: 0,
            skippedCount: products.length,
          };
        }

        // 4. Save based on mode
        let savedCount = 0;

        if (mode === 'baseline' || mode === 're-baseline') {
          savedCount = await this.saveBaselineBatch(
            supplierId,
            companyId,
            matchedProducts,
            eanToMasterProductId
          );
        } else if (mode === 'delta' && baselinePriceMap) {
          savedCount = await this.saveDeltaBatch(
            supplierId,
            companyId,
            matchedProducts,
            eanToMasterProductId,
            baselinePriceMap
          );
        }

        return {
          batchSize: products.length,
          matchedCount: matchedProducts.length,
          savedCount,
          skippedCount: products.length - matchedProducts.length,
        };
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        batchLog.error({ err }, 'Batch save error');
        return {
          batchSize: products.length,
          matchedCount: 0,
          savedCount: 0,
          skippedCount: products.length,
          error: err.message,
        };
      }
    };
  }

  private normalizeSupplierProductCode(code: string | null | undefined): string {
    return (code ?? '').trim();
  }

  private buildSupplierProductKey(masterProductId: string, supplierProductCode: string): string {
    return `${masterProductId}|${supplierProductCode}`;
  }

  /**
   * Deduplicate rows by composite key before upsert.
   * Last occurrence wins (freshest data from latest category/page).
   */
  private deduplicateByKey<T>(rows: T[], keyFn: (row: T) => string): T[] {
    const seen = new Map<string, T>();
    for (const row of rows) {
      seen.set(keyFn(row), row);
    }
    return Array.from(seen.values());
  }

  /**
   * Save a single batch of products in baseline or re-baseline mode.
   * Upserts to supplier_products table.
   */
  private async saveBaselineBatch(
    supplierId: string,
    companyId: string,
    products: ScrapedProduct[],
    eanToMasterProductId: Map<string, string>
  ): Promise<number> {
    const batchLog = log.child({
      supplierId,
      companyId,
      mode: 'baseline',
      batchSize: products.length,
    });
    const rawData: SupplierProductInsert[] = products.map((p) => {
      const metadata = p.metadata;
      const internalProductId =
        typeof metadata?.internal_product_id === 'string' &&
        metadata.internal_product_id.trim().length > 0
          ? metadata.internal_product_id
          : null;
      // Pack metadata is published by each supplier and parsed into
      // `metadata.unit_cost_incl_vat` / `pack_count` / `pack_unit_size` by
      // the per-supplier pack extractor. Any missing value stays NULL so
      // priceCheck can fall back gracefully.
      const unitCostInclVat =
        typeof metadata?.unit_cost_incl_vat === 'number' &&
        Number.isFinite(metadata.unit_cost_incl_vat)
          ? metadata.unit_cost_incl_vat
          : null;
      const packCount =
        typeof metadata?.pack_count === 'number' && metadata.pack_count > 0
          ? metadata.pack_count
          : null;
      const packUnitSize =
        typeof metadata?.pack_unit_size === 'string' && metadata.pack_unit_size.trim().length > 0
          ? metadata.pack_unit_size
          : null;

      return {
        supplier_id: supplierId,
        // biome-ignore lint/style/noNonNullAssertion: products are pre-filtered to have matching EANs
        master_product_id: eanToMasterProductId.get(p.eanCode)!,
        supplier_product_code: this.normalizeSupplierProductCode(p.supplierProductCode),
        internal_product_id: internalProductId,
        current_price: p.price,
        unit_cost_incl_vat: unitCostInclVat,
        pack_count: packCount,
        pack_unit_size: packUnitSize,
        vat_rate: p.vatRate ?? 0,
        availability_status: p.availability,
        last_updated: new Date().toISOString(),
        scraped_from_company_id: companyId,
      };
    });

    // Deduplicate by conflict key — same product from multiple categories keeps last occurrence
    const supplierProductsData = this.deduplicateByKey(
      rawData,
      (r) => `${r.supplier_id}|${r.master_product_id}|${r.supplier_product_code}`
    );

    if (rawData.length !== supplierProductsData.length) {
      batchLog.info(
        { before: rawData.length, after: supplierProductsData.length },
        'Deduplicated batch before upsert'
      );
    }

    const { error } = await this.supabase
      .from('supplier_products')
      .upsert(supplierProductsData as never, {
        onConflict: 'supplier_id,master_product_id,supplier_product_code',
        ignoreDuplicates: false,
      });

    if (error) {
      batchLog.error({ err: error }, 'Error saving baseline batch');
      throw error;
    }

    return supplierProductsData.length;
  }

  /**
   * Save a single batch of products in delta mode.
   * Only saves products where price differs from baseline.
   * Upserts to supplier_company_prices table.
   */
  private async saveDeltaBatch(
    supplierId: string,
    companyId: string,
    products: ScrapedProduct[],
    eanToMasterProductId: Map<string, string>,
    baselinePriceMap: Map<string, number>
  ): Promise<number> {
    const batchLog = log.child({
      supplierId,
      companyId,
      mode: 'delta',
      batchSize: products.length,
    });
    const now = new Date().toISOString();
    const deltas: SupplierCompanyPriceInsert[] = [];

    for (const product of products) {
      const masterProductId = eanToMasterProductId.get(product.eanCode);
      if (!masterProductId) continue;

      const supplierProductCode = this.normalizeSupplierProductCode(product.supplierProductCode);
      if (!supplierProductCode) continue;

      const baselineKey = this.buildSupplierProductKey(masterProductId, supplierProductCode);
      const baselinePrice = baselinePriceMap.get(baselineKey);

      // Skip if no baseline exists for this product
      if (baselinePrice === undefined) {
        continue;
      }

      // Only save if price differs from baseline
      if (product.price !== baselinePrice) {
        deltas.push({
          supplier_id: supplierId,
          company_id: companyId,
          master_product_id: masterProductId,
          supplier_product_code: supplierProductCode,
          negotiated_price: product.price,
          valid_from: now,
          valid_until: null,
          notes: `Delta from baseline: ${baselinePrice} -> ${product.price}`,
        });
      }
    }

    if (deltas.length === 0) {
      return 0;
    }

    // Deduplicate by conflict key — same product from multiple categories keeps last occurrence
    const uniqueDeltas = this.deduplicateByKey(
      deltas,
      (r) => `${r.supplier_id}|${r.company_id}|${r.master_product_id}|${r.supplier_product_code}`
    );

    const { error } = await this.supabase
      .from('supplier_company_prices')
      .upsert(uniqueDeltas as never, {
        onConflict: 'supplier_id,company_id,master_product_id,supplier_product_code',
        ignoreDuplicates: false,
      });

    if (error) {
      batchLog.error({ err: error }, 'Error saving delta batch');
      throw error;
    }

    return uniqueDeltas.length;
  }

  /**
   * Load all baseline prices for a supplier.
   * Used in delta mode to compare incoming prices against baseline.
   * Loads in batches to handle large datasets.
   */
  private async loadBaselinePrices(supplierId: string): Promise<Map<string, number>> {
    const supplierLog = log.child({ supplierId });
    supplierLog.debug('Loading baseline prices');

    const priceMap = new Map<string, number>();
    const BATCH_SIZE = 5000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await this.supabase
        .from('supplier_products')
        .select('master_product_id, supplier_product_code, current_price')
        .eq('supplier_id', supplierId)
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) {
        supplierLog.error({ err: error }, 'Error loading baseline prices');
        throw error;
      }

      if (data && data.length > 0) {
        type BaselineRow = {
          master_product_id: string;
          supplier_product_code: string | null;
          current_price: number;
        };
        for (const row of data as BaselineRow[]) {
          const supplierProductCode = this.normalizeSupplierProductCode(row.supplier_product_code);
          if (!supplierProductCode) continue;

          const key = this.buildSupplierProductKey(row.master_product_id, supplierProductCode);
          priceMap.set(key, Number(row.current_price));
        }
        hasMore = data.length === BATCH_SIZE;
        offset += BATCH_SIZE;
      } else {
        hasMore = false;
      }
    }

    supplierLog.debug({ priceCount: priceMap.size }, 'Loaded baseline prices');
    return priceMap;
  }

  /**
   * Get the count of supplier_products for a supplier.
   * Used for safety threshold checks.
   *
   * @param supplierId - Supplier ID
   * @returns Number of products for this supplier
   */
  private async getSupplierProductCount(supplierId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('supplier_products')
      .select('*', { count: 'exact', head: true })
      .eq('supplier_id', supplierId);

    if (error) {
      log.error({ supplierId, err: error }, 'Error getting supplier product count');
      return 0;
    }

    return count ?? 0;
  }

  /**
   * Mark products as 'not_found' that were not updated during the current scrape.
   * Uses timestamp-based detection: any product with last_updated < scrapeStartTime
   * was not found on the supplier website during this scrape.
   *
   * @param supplierId - Supplier ID
   * @param scrapeStartTime - ISO timestamp of when the scrape started
   * @returns Number of products marked as not_found
   */
  private async markNotFoundProducts(supplierId: string, scrapeStartTime: string): Promise<number> {
    const supplierLog = log.child({ supplierId, scrapeStartTime });
    supplierLog.debug('Marking stale products as not_found');

    const now = new Date().toISOString();

    const { error, count } = await this.supabase
      .from('supplier_products')
      .update({
        availability_status: 'not_found',
        last_updated: now,
      } as never)
      .eq('supplier_id', supplierId)
      .lt('last_updated', scrapeStartTime)
      .neq('availability_status', 'not_found'); // Don't update already not_found products

    if (error) {
      supplierLog.error({ err: error }, 'Error marking products as not_found');
      return 0;
    }

    const updatedCount = count ?? 0;
    supplierLog.debug({ updatedCount }, 'Marked products as not_found');
    return updatedCount;
  }

  // ============ Legacy Save Methods (kept for reference/fallback) ============
  private async saveProducts(
    supplierId: string,
    companyId: string,
    products: ScrapedProduct[],
    mode: ScrapingMode
  ): Promise<SaveProductsResult> {
    const supplierLog = log.child({ supplierId, companyId, mode });

    if (products.length === 0) {
      return { mode, savedCount: 0 };
    }

    supplierLog.debug({ productCount: products.length }, 'Saving products');

    // Get master product mappings by EAN code IN BATCHES
    // Supabase/PostgREST has limits on .in() clause size and response header size
    // Using 720 to match API batch size while avoiding header overflow
    const eanCodes = products.map((p) => p.eanCode).filter(Boolean);
    const LOOKUP_BATCH_SIZE = 720;
    const allMasterProducts: Pick<MasterProduct, 'id' | 'ean_code'>[] = [];

    supplierLog.debug(
      { eanCount: eanCodes.length, lookupBatchSize: LOOKUP_BATCH_SIZE },
      'Looking up EAN codes'
    );

    for (let i = 0; i < eanCodes.length; i += LOOKUP_BATCH_SIZE) {
      const batch = eanCodes.slice(i, i + LOOKUP_BATCH_SIZE);
      const batchNum = Math.floor(i / LOOKUP_BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(eanCodes.length / LOOKUP_BATCH_SIZE);

      const { data, error: mpError } = await this.supabase
        .from('master_products')
        .select('id, ean_code')
        .in('ean_code', batch);

      if (mpError) {
        supplierLog.error(
          { batchNum, totalBatches, err: mpError },
          'Error fetching master products batch'
        );
        throw mpError;
      }

      if (data) {
        allMasterProducts.push(...(data as Pick<MasterProduct, 'id' | 'ean_code'>[]));
      }

      if (batchNum % 5 === 0 || batchNum === totalBatches) {
        supplierLog.debug(
          { batchNum, totalBatches, matchesSoFar: allMasterProducts.length },
          'Master product lookup progress'
        );
      }
    }

    const eanToMasterProductId = new Map(allMasterProducts.map((mp) => [mp.ean_code, mp.id]));

    // Filter products that have matching master products
    const matchedProducts = products.filter((p) => eanToMasterProductId.has(p.eanCode));

    if (matchedProducts.length === 0) {
      supplierLog.warn('No matching master products found for scraped data');
      return { mode, savedCount: 0 };
    }

    supplierLog.debug(
      { matchedCount: matchedProducts.length },
      'Products matched to master products'
    );

    // Route to appropriate save method based on mode
    switch (mode) {
      case 'baseline':
      case 're-baseline':
        return this.saveBaselineProducts(
          supplierId,
          companyId,
          matchedProducts,
          eanToMasterProductId,
          mode
        );
      case 'delta':
        return this.saveDeltaProducts(supplierId, companyId, matchedProducts, eanToMasterProductId);
    }
  }

  /**
   * Save products as baseline (first company) or update baseline (re-scraping baseline company).
   * Upserts to supplier_products with scraped_from_company_id set.
   * Saves in batches of 1000 to avoid timeouts on large datasets.
   */
  private async saveBaselineProducts(
    supplierId: string,
    companyId: string,
    products: ScrapedProduct[],
    eanToMasterProductId: Map<string | null, string>,
    mode: 'baseline' | 're-baseline'
  ): Promise<SaveProductsResult> {
    const BATCH_SIZE = 1000;
    const total = products.length;
    const supplierLog = log.child({ supplierId, companyId, mode, total, batchSize: BATCH_SIZE });

    supplierLog.debug('Saving baseline products');

    // Prepare upsert data with scraped_from_company_id
    const rawData: SupplierProductInsert[] = products.map((p) => {
      // biome-ignore lint/style/noNonNullAssertion: products are pre-filtered to have matching EANs
      const masterProductId = eanToMasterProductId.get(p.eanCode)!;
      const metadata = p.metadata;
      const internalProductId =
        typeof metadata?.internal_product_id === 'string' &&
        metadata.internal_product_id.trim().length > 0
          ? metadata.internal_product_id
          : null;
      const unitCostInclVat =
        typeof metadata?.unit_cost_incl_vat === 'number' &&
        Number.isFinite(metadata.unit_cost_incl_vat)
          ? metadata.unit_cost_incl_vat
          : null;
      const packCount =
        typeof metadata?.pack_count === 'number' && metadata.pack_count > 0
          ? metadata.pack_count
          : null;
      const packUnitSize =
        typeof metadata?.pack_unit_size === 'string' && metadata.pack_unit_size.trim().length > 0
          ? metadata.pack_unit_size
          : null;

      return {
        supplier_id: supplierId,
        master_product_id: masterProductId,
        supplier_product_code: this.normalizeSupplierProductCode(p.supplierProductCode),
        internal_product_id: internalProductId,
        current_price: p.price,
        unit_cost_incl_vat: unitCostInclVat,
        pack_count: packCount,
        pack_unit_size: packUnitSize,
        vat_rate: p.vatRate ?? 0,
        availability_status: p.availability,
        last_updated: new Date().toISOString(),
        scraped_from_company_id: companyId,
      };
    });

    // Deduplicate by conflict key — same product from multiple categories keeps last occurrence
    const supplierProductsData = this.deduplicateByKey(
      rawData,
      (r) => `${r.supplier_id}|${r.master_product_id}|${r.supplier_product_code}`
    );

    if (rawData.length !== supplierProductsData.length) {
      supplierLog.info(
        { before: rawData.length, after: supplierProductsData.length },
        'Deduplicated products before upsert'
      );
    }

    // Upsert supplier products in batches
    let savedCount = 0;
    const totalBatches = Math.ceil(supplierProductsData.length / BATCH_SIZE);

    for (let i = 0; i < supplierProductsData.length; i += BATCH_SIZE) {
      const batch = supplierProductsData.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      const { error } = await this.supabase.from('supplier_products').upsert(batch as never, {
        onConflict: 'supplier_id,master_product_id,supplier_product_code',
        ignoreDuplicates: false,
      });

      if (error) {
        throw error;
      }

      savedCount += batch.length;
      supplierLog.debug({ batchNum, totalBatches, savedCount, total }, 'Baseline batch saved');
    }

    supplierLog.info({ savedCount, total }, 'Completed saving baseline products');

    return { mode, savedCount };
  }

  /**
   * Save products as deltas (price differences from baseline).
   * Only stores products where price differs from baseline in supplier_company_prices.
   * Saves in batches of 1000 to avoid timeouts on large datasets.
   */
  private async saveDeltaProducts(
    supplierId: string,
    companyId: string,
    products: ScrapedProduct[],
    eanToMasterProductId: Map<string | null, string>
  ): Promise<SaveProductsResult> {
    const BATCH_SIZE = 1000; // For saving/upserting
    const LOOKUP_BATCH_SIZE = 720; // For .in() queries to match API batch size
    const supplierLog = log.child({
      supplierId,
      companyId,
      mode: 'delta',
      productCount: products.length,
    });

    supplierLog.debug('Comparing products to baseline');

    // Get master product IDs for the scraped products
    const masterProductIds = products
      .map((p) => eanToMasterProductId.get(p.eanCode))
      .filter((id): id is string => !!id);

    // Fetch baseline prices from supplier_products IN BATCHES
    type BaselinePrice = {
      master_product_id: string;
      supplier_product_code: string | null;
      current_price: number;
    };
    const allBaselineProducts: BaselinePrice[] = [];

    supplierLog.debug(
      { masterProductCount: masterProductIds.length, lookupBatchSize: LOOKUP_BATCH_SIZE },
      'Fetching baseline prices'
    );

    for (let i = 0; i < masterProductIds.length; i += LOOKUP_BATCH_SIZE) {
      const batch = masterProductIds.slice(i, i + LOOKUP_BATCH_SIZE);
      const batchNum = Math.floor(i / LOOKUP_BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(masterProductIds.length / LOOKUP_BATCH_SIZE);

      const { data, error: bpError } = await this.supabase
        .from('supplier_products')
        .select('master_product_id, supplier_product_code, current_price')
        .eq('supplier_id', supplierId)
        .in('master_product_id', batch);

      if (bpError) {
        supplierLog.error(
          { batchNum, totalBatches, err: bpError },
          'Error fetching baseline prices batch'
        );
        throw bpError;
      }

      if (data) {
        allBaselineProducts.push(...(data as BaselinePrice[]));
      }

      if (batchNum % 2 === 0 || batchNum === totalBatches) {
        supplierLog.debug(
          { batchNum, totalBatches, pricesSoFar: allBaselineProducts.length },
          'Baseline price lookup progress'
        );
      }
    }

    // Create a map of baseline prices keyed by master product + supplier product code
    const baselinePriceMap = new Map<string, number>();
    for (const baselineProduct of allBaselineProducts) {
      const supplierProductCode = this.normalizeSupplierProductCode(
        baselineProduct.supplier_product_code
      );
      if (!supplierProductCode) continue;

      const key = this.buildSupplierProductKey(
        baselineProduct.master_product_id,
        supplierProductCode
      );
      baselinePriceMap.set(key, Number(baselineProduct.current_price));
    }

    // Find price differences
    const deltas: SupplierCompanyPriceInsert[] = [];
    const now = new Date().toISOString();

    for (const product of products) {
      const masterProductId = eanToMasterProductId.get(product.eanCode);
      if (!masterProductId) continue;

      const supplierProductCode = this.normalizeSupplierProductCode(product.supplierProductCode);
      if (!supplierProductCode) continue;

      const baselineKey = this.buildSupplierProductKey(masterProductId, supplierProductCode);
      const baselinePrice = baselinePriceMap.get(baselineKey);

      // Skip if no baseline exists for this product
      if (baselinePrice === undefined) {
        continue;
      }

      // Compare prices - any difference triggers a delta
      if (product.price !== baselinePrice) {
        deltas.push({
          supplier_id: supplierId,
          company_id: companyId,
          master_product_id: masterProductId,
          supplier_product_code: supplierProductCode,
          negotiated_price: product.price,
          valid_from: now,
          valid_until: null, // No expiry
          notes: `Delta from baseline: ${baselinePrice} -> ${product.price}`,
        });
      }
    }

    supplierLog.info({ deltasFound: deltas.length }, 'Price delta comparison completed');

    if (deltas.length === 0) {
      supplierLog.info('No price differences found');
      return { mode: 'delta', savedCount: 0, deltasFound: 0 };
    }

    // Upsert deltas to supplier_company_prices in batches
    let savedCount = 0;
    const totalBatches = Math.ceil(deltas.length / BATCH_SIZE);

    for (let i = 0; i < deltas.length; i += BATCH_SIZE) {
      const batch = deltas.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      const { error } = await this.supabase.from('supplier_company_prices').upsert(batch as never, {
        onConflict: 'supplier_id,company_id,master_product_id,supplier_product_code',
        ignoreDuplicates: false,
      });

      if (error) {
        supplierLog.error(
          { batchNum, totalBatches, err: error },
          'Error saving delta prices batch'
        );
        throw error;
      }

      savedCount += batch.length;
      supplierLog.debug(
        { batchNum, totalBatches, savedCount, deltasFound: deltas.length },
        'Delta batch saved'
      );
    }

    supplierLog.info({ savedCount, deltasFound: deltas.length }, 'Completed saving delta prices');

    return { mode: 'delta', savedCount, deltasFound: deltas.length };
  }

  /**
   * Create a failed result object.
   */
  private createFailedResult(job: ScrapingJob, errorMessage: string): ScrapeResult {
    const scraper = getScraper(job.config.supplierId);

    return {
      runId: job.id,
      supplierId: job.config.supplierId,
      supplierName: scraper?.name ?? 'Unknown',
      locationId: job.config.locationId,
      companyId: job.config.companyId,
      scrapingMode: 'baseline', // Default, doesn't matter for failed jobs
      status: 'failed',
      startedAt: job.startedAt ?? new Date(),
      completedAt: new Date(),
      durationMs: job.startedAt ? Date.now() - job.startedAt.getTime() : 0,
      productCount: 0,
      savedCount: 0,
      products: [],
      error: errorMessage,
    };
  }

  /**
   * Get a job by ID.
   */
  getJob(jobId: string): ScrapingJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs.
   */
  getAllJobs(): ScrapingJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get jobs by status.
   */
  getJobsByStatus(status: JobStatus): ScrapingJob[] {
    return this.getAllJobs().filter((job) => job.status === status);
  }

  /**
   * Get recent jobs (last N).
   */
  getRecentJobs(limit = 20): ScrapingJob[] {
    return this.getAllJobs()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Get scraping statistics.
   */
  getStats(): ScrapingStats {
    const jobs = this.getAllJobs();
    const completedJobs = jobs.filter((j) => j.status === 'completed');

    const totalDuration = completedJobs.reduce(
      (sum, job) => sum + (job.result?.durationMs ?? 0),
      0
    );

    return {
      totalJobs: jobs.length,
      pendingJobs: jobs.filter((j) => j.status === 'pending').length,
      runningJobs: jobs.filter((j) => j.status === 'running').length,
      completedJobs: completedJobs.length,
      failedJobs: jobs.filter((j) => j.status === 'failed').length,
      lastRunAt:
        completedJobs.length > 0
          ? new Date(Math.max(...completedJobs.map((j) => j.completedAt?.getTime() ?? 0)))
          : undefined,
      averageDurationMs:
        completedJobs.length > 0 ? totalDuration / completedJobs.length : undefined,
    };
  }

  /**
   * Get registered scraper info.
   */
  getScraperInfo() {
    return getScraperInfo();
  }

  /**
   * Clear old jobs from memory (cleanup).
   */
  clearOldJobs(maxAgeMs = 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAgeMs;
    let cleared = 0;

    for (const [id, job] of this.jobs) {
      if (job.createdAt.getTime() < cutoff && job.status !== 'running') {
        this.jobs.delete(id);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Cancel a pending job.
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);

    if (!job || job.status !== 'pending') {
      return false;
    }

    job.status = 'cancelled';
    job.completedAt = new Date();
    return true;
  }
}

// Singleton instance
export const scrapingService = new ScrapingService();
