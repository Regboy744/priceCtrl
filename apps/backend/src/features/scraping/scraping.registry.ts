import { getServiceClient } from '../../shared/database/supabase.js';
import { createLogger } from '../../shared/services/logger.service.js';
import type { BaseScraper } from './base.scraper.js';

const log = createLogger('ScraperRegistry');

// Import traditional scrapers
import { BarryGroupScraper } from '../suppliers/barry-group/barry-group.scraper.js';
import { MusgraveScraper } from '../suppliers/musgrave/musgrave.scraper.js';
import { OreillyScraper } from '../suppliers/oreillys/oreillys.scraper.js';
import { SavageWhittenScraper } from '../suppliers/savage-whitten/savage-whitten.scraper.js';
import { ValueCentreScraper } from '../suppliers/value-centre/value-centre.scraper.js';

/**
 * Registry of all available supplier scrapers.
 * Maps supplier ID to scraper instance.
 *
 * Supports both:
 * - Traditional BaseScraper subclasses (for complex/hybrid implementations)
 * - ConfigurableScraper instances created from config (for standard web scrapers)
 *
 * Supplier IDs are resolved from the database during initialization
 * using the scraper's `supplierName` property.
 */
class ScraperRegistry {
  private scrapers: Map<string, BaseScraper> = new Map();
  private initialized = false;

  /**
   * Initialize the registry by loading supplier IDs from the database.
   * Must be called before using any other methods.
   *
   * @throws Error if database lookup fails or any scraper's supplier is not found
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    log.info('Initializing - loading supplier IDs from database');

    // All scrapers now use the hybrid approach:
    // Puppeteer for login → curl-impersonate + cheerio for scraping
    const allScrapers: BaseScraper[] = [
      new MusgraveScraper(),
      new OreillyScraper(),
      new ValueCentreScraper(),
      new BarryGroupScraper(),
      new SavageWhittenScraper(),
    ];

    // Fetch all active suppliers from database in one query
    const supabase = getServiceClient();
    const { data: suppliers, error } = await supabase
      .from('suppliers')
      .select('id, name')
      .eq('is_active', true);

    if (error) {
      throw new Error(`[ScraperRegistry] Failed to load suppliers from database: ${error.message}`);
    }

    if (!suppliers || suppliers.length === 0) {
      throw new Error('[ScraperRegistry] No active suppliers found in database');
    }

    // Create lookup map: supplier name -> supplier id
    const supplierMap = new Map<string, string>(
      suppliers.map((s: { id: string; name: string }) => [s.name, s.id])
    );

    log.debug({ count: suppliers.length }, 'Found active suppliers in database');

    // Resolve supplier IDs and register each scraper
    const missingSuppliers: string[] = [];

    for (const scraper of allScrapers) {
      const supplierId = supplierMap.get(scraper.supplierName);

      if (!supplierId) {
        missingSuppliers.push(scraper.supplierName);
        continue;
      }

      // Set the supplier ID on the scraper instance
      scraper.supplierId = supplierId;

      // Register in the map
      this.scrapers.set(supplierId, scraper);

      log.debug({ name: scraper.name, supplierId }, 'Scraper registered');
    }

    // Fail if any scrapers couldn't be matched to database suppliers
    if (missingSuppliers.length > 0) {
      throw new Error(
        `[ScraperRegistry] The following suppliers are not found in the database: ${missingSuppliers.join(', ')}. Please ensure supplier names in scraper classes match the database exactly.`
      );
    }

    this.initialized = true;
    log.info({ count: this.scrapers.size }, 'Initialization complete');
  }

  /**
   * Ensure the registry is initialized before use.
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        '[ScraperRegistry] Registry not initialized. Call initialize() during app startup.'
      );
    }
  }

  /**
   * Get a scraper by supplier ID.
   */
  get(supplierId: string): BaseScraper | undefined {
    this.ensureInitialized();
    return this.scrapers.get(supplierId);
  }

  /**
   * Get all registered scrapers.
   */
  getAll(): BaseScraper[] {
    this.ensureInitialized();
    return Array.from(this.scrapers.values());
  }

  /**
   * Get all supplier IDs.
   */
  getAllIds(): string[] {
    this.ensureInitialized();
    return Array.from(this.scrapers.keys());
  }

  /**
   * Check if a scraper exists for the given supplier ID.
   */
  has(supplierId: string): boolean {
    this.ensureInitialized();
    return this.scrapers.has(supplierId);
  }

  /**
   * Get count of registered scrapers.
   */
  get count(): number {
    this.ensureInitialized();
    return this.scrapers.size;
  }

  /**
   * Check if the registry has been initialized.
   */
  get isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get scraper info for all registered scrapers.
   */
  getInfo(): Array<{ supplierId: string; name: string; baseUrl: string }> {
    this.ensureInitialized();
    return this.getAll().map((scraper) => ({
      supplierId: scraper.supplierId,
      name: scraper.name,
      baseUrl: scraper.baseUrl,
    }));
  }
}

// Singleton instance
export const scraperRegistry = new ScraperRegistry();

// Helper functions for direct access
export function getScraper(supplierId: string): BaseScraper | undefined {
  return scraperRegistry.get(supplierId);
}

export function getAllScrapers(): BaseScraper[] {
  return scraperRegistry.getAll();
}

export function getScraperInfo(): Array<{ supplierId: string; name: string; baseUrl: string }> {
  return scraperRegistry.getInfo();
}
