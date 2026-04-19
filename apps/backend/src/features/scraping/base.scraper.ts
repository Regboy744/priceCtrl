import { mkdir, writeFile } from 'node:fs/promises';
import type { Browser, Page } from 'puppeteer';
import { LoginError, NavigationError } from '../../shared/errors/AppError.js';
import type { BrowserOptions } from '../../shared/services/browser.service.js';
import { type BrowserService, browserService } from '../../shared/services/browser.service.js';
import { createLogger } from '../../shared/services/logger.service.js';
import { proxyService } from '../../shared/services/proxy/proxy.service.js';
import type { ProxyCredentials } from '../../shared/services/proxy/proxy.types.js';
import type { SupplierCredentials } from '../../shared/services/vault.service.js';
import type {
  ISupplierScraper,
  ProductBatchSaveCallback,
  ScrapedProduct,
  StreamingScrapeStats,
} from './scraping.types.js';

/**
 * Abstract base class for all supplier scrapers.
 *
 * Each scraper instance owns its own isolated browser for true parallel execution.
 * This prevents resource contention when multiple scrapers run concurrently.
 *
 * Provides common functionality for browser management, human simulation, and error handling.
 * Each supplier implementation extends this class and implements the abstract methods.
 */
export abstract class BaseScraper implements ISupplierScraper {
  private readonly loginChallengeKeywords = [
    'verify you are human',
    'captcha',
    'radware',
    'access denied',
    'bot manager',
    'incident id',
    'cloudflare',
  ] as const;

  /** Module logger — initialized lazily so `this.name` is available */
  protected get log() {
    if (!this._log) {
      this._log = createLogger(this.name);
    }
    return this._log;
  }
  private _log: ReturnType<typeof createLogger> | null = null;

  /** Set by ScraperRegistry during initialization via database lookup */
  supplierId!: string;

  /** Supplier name as stored in database - used for ID lookup */
  abstract readonly supplierName: string;

  /** Human-readable display name */
  abstract readonly name: string;

  /** Base URL of the supplier website */
  abstract readonly baseUrl: string;

  protected browserService: BrowserService = browserService;

  /** This scraper's dedicated browser instance */
  protected browser: Browser | null = null;

  /** Main page for this scraper */
  protected page: Page | null = null;

  /**
   * Resolved proxy credentials for this scraper's browser/pages.
   * Populated during initialize() when proxy is enabled.
   * Exposed as protected so ConfigurableScraper and page pools can reuse them.
   */
  protected proxyCredentials: ProxyCredentials | undefined;

  protected credentials: SupplierCredentials | null = null;
  protected isInitialized = false;

  /**
   * Initialize the scraper by creating its own dedicated browser and page.
   * Each scraper gets an isolated browser for true parallel execution.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized && this.browser?.connected && this.page && !this.page.isClosed()) {
      return;
    }

    // Resolve proxy credentials for this supplier. Returns null when the
    // pool the supplier is configured to use is disabled — in that case the
    // browser launches without a proxy (direct egress).
    this.proxyCredentials =
      proxyService.buildCredentialsForSupplier(this.supplierName) ?? undefined;

    const browserOpts: BrowserOptions = { proxyCredentials: this.proxyCredentials };

    // Create dedicated browser for this scraper
    this.browser = await this.browserService.createIsolatedBrowser(this.name, browserOpts);

    // Create main page in our dedicated browser
    this.page = await this.browserService.createPageInBrowser(this.browser, browserOpts);

    this.isInitialized = true;
    const proxyInfo = this.proxyCredentials
      ? ` (via proxy ${this.proxyCredentials.serverArg})`
      : '';
    this.log.debug(
      { proxyServer: this.proxyCredentials?.serverArg },
      'Scraper initialized with dedicated browser'
    );
  }

  /**
   * Abstract method: Implement the login flow for this supplier.
   * @param credentials - The credentials to use for login
   */
  abstract login(credentials: SupplierCredentials): Promise<void>;

  /**
   * Abstract method: Implement the product scraping logic for this supplier.
   * Products should be saved incrementally via the callback as batches are ready.
   *
   * @param onBatchReady - Callback to save each batch of products (provided by ScrapingService)
   * @returns Statistics about the scrape operation
   */
  abstract scrapeProducts(onBatchReady?: ProductBatchSaveCallback): Promise<StreamingScrapeStats>;

  /**
   * Check if the supplier website is accessible.
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.ensureInitialized();

      if (!this.page) return false;

      const response = await this.page.goto(this.baseUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      return response?.ok() ?? false;
    } catch (error) {
      this.log.error({ err: error }, 'Health check failed');
      return false;
    }
  }

  /**
   * Clean up resources - closes the dedicated browser instance.
   */
  async cleanup(): Promise<void> {
    // Close main page first
    if (this.page) {
      await this.browserService.closePage(this.page);
      this.page = null;
    }

    // Close dedicated browser
    if (this.browser) {
      await this.browserService.closeIsolatedBrowser(this.browser, this.name);
      this.browser = null;
    }

    this.isInitialized = false;
    this.credentials = null;
    this.log.debug('Scraper cleaned up');
  }

  // ============ Protected Helper Methods ============

  /**
   * Ensure the scraper is initialized before performing operations.
   */
  protected async ensureInitialized(): Promise<void> {
    if (!this.isInitialized || !this.browser?.connected || !this.page || this.page.isClosed()) {
      await this.initialize();
    }
  }

  /**
   * Get the current page, throwing if not initialized.
   */
  protected getPage(): Page {
    if (!this.page || this.page.isClosed()) {
      throw new Error('Page not initialized. Call initialize() first.');
    }
    return this.page;
  }

  /**
   * Get this scraper's dedicated browser instance.
   * Used by ConfigurableScraper for creating page pools.
   */
  protected getBrowser(): Browser {
    if (!this.browser || !this.browser.connected) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }
    return this.browser;
  }

  /**
   * Navigate to a URL with error handling.
   */
  protected async navigateTo(url: string): Promise<void> {
    const page = this.getPage();

    try {
      await this.browserService.safeNavigate(page, url);
      this.log.debug({ url }, 'Navigated to URL');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new NavigationError(`Failed to navigate to ${url}: ${msg}`, this.supplierId);
    }
  }

  /**
   * Wait for a selector with timeout and error handling.
   */
  protected async waitForSelector(
    selector: string,
    options?: { timeout?: number; visible?: boolean }
  ): Promise<void> {
    const page = this.getPage();

    try {
      await page.waitForSelector(selector, {
        timeout: options?.timeout ?? 10000,
        visible: options?.visible ?? true,
      });
    } catch (error) {
      throw new Error(`Selector not found: ${selector}`);
    }
  }

  /**
   * Human-like delay between actions.
   */
  protected async delay(minMs = 500, maxMs = 2000): Promise<void> {
    await this.browserService.humanDelay(minMs, maxMs);
  }

  /**
   * Human-like typing in an input field.
   */
  protected async typeText(selector: string, text: string): Promise<void> {
    const page = this.getPage();
    await this.browserService.humanType(page, selector, text);
  }

  /**
   * Click an element and wait for navigation if needed.
   */
  protected async clickAndWait(selector: string, waitForNavigation = false): Promise<void> {
    const page = this.getPage();

    if (waitForNavigation) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2' }),
        page.click(selector),
      ]);
    } else {
      await page.click(selector);
    }
  }

  /**
   * Human-like click with mouse movement.
   */
  protected async humanClick(selector: string): Promise<void> {
    const page = this.getPage();
    await this.browserService.humanClick(page, selector);
  }

  /**
   * Random micro-movements to simulate natural behavior.
   */
  protected async humanMicroMovements(): Promise<void> {
    const page = this.getPage();
    await this.browserService.humanMicroMovements(page);
  }

  /**
   * Take a screenshot for debugging.
   */
  protected async screenshot(filename: string): Promise<void> {
    const page = this.getPage();
    await mkdir('screenshots', { recursive: true });
    await page.screenshot({
      path: `screenshots/${filename}-${Date.now()}.png`,
      fullPage: true,
    });
  }

  /**
   * Capture login diagnostics for failed attempts.
   *
   * Saves screenshot, full HTML, and metadata (URL/title/challenge detection)
   * to the screenshots/ directory so we can inspect bot-challenge pages.
   */
  protected async captureLoginDiagnostics(attempt: number, error: Error): Promise<void> {
    const page = this.getPage();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const supplierSlug = this.slugify(this.name || this.supplierName || 'scraper');
    const filePrefix = `${supplierSlug}-login-attempt-${attempt}-${timestamp}`;

    const outputDir = 'screenshots';
    const screenshotPath = `${outputDir}/${filePrefix}.png`;
    const htmlPath = `${outputDir}/${filePrefix}.html`;
    const metadataPath = `${outputDir}/${filePrefix}.json`;

    await mkdir(outputDir, { recursive: true });

    let url = 'unknown';
    let title = 'unknown';
    let html = '';
    let bodyText = '';

    try {
      url = page.url();
    } catch {
      // Ignore URL extraction failures in diagnostics.
    }

    try {
      title = await page.title();
    } catch {
      // Ignore title extraction failures in diagnostics.
    }

    try {
      html = await page.content();
    } catch {
      // Ignore HTML extraction failures in diagnostics.
    }

    try {
      bodyText = await page.evaluate(() => document.body?.innerText ?? '');
    } catch {
      // Ignore body text extraction failures in diagnostics.
    }

    const normalizedFingerprint = `${title}\n${bodyText}\n${html.slice(0, 5000)}`.toLowerCase();
    const matchedKeyword =
      this.loginChallengeKeywords.find((keyword) => normalizedFingerprint.includes(keyword)) ??
      null;
    const challengeDetected = matchedKeyword !== null;

    try {
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
      });
    } catch (screenshotError) {
      this.log.warn({ err: screenshotError }, 'Failed to save login screenshot');
    }

    await writeFile(htmlPath, html || '<!-- empty html -->', 'utf8');

    const metadata = {
      supplierName: this.name,
      supplierId: this.supplierId,
      attempt,
      timestamp: new Date().toISOString(),
      error: error.message,
      url,
      title,
      proxyServer: this.proxyCredentials?.serverArg ?? null,
      challengeDetected,
      matchedKeyword,
      bodyTextPreview: bodyText.slice(0, 1500),
    };

    await writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

    this.log.warn({ screenshotPath, htmlPath, metadataPath }, 'Login diagnostics saved');

    if (challengeDetected) {
      this.log.warn({ matchedKeyword }, 'Potential anti-bot challenge detected during login');
    }
  }

  /**
   * Convert supplier names into safe filename slugs.
   */
  private slugify(input: string): string {
    const slug = input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);

    return slug || 'scraper';
  }

  /**
   * Extract text content from an element.
   */
  protected async getText(selector: string): Promise<string | null> {
    const page = this.getPage();

    try {
      return await page.$eval(selector, (el) => el.textContent?.trim() ?? null);
    } catch {
      return null;
    }
  }

  /**
   * Extract attribute value from an element.
   */
  protected async getAttribute(selector: string, attribute: string): Promise<string | null> {
    const page = this.getPage();

    try {
      return await page.$eval(selector, (el, attr) => el.getAttribute(attr), attribute);
    } catch {
      return null;
    }
  }

  /**
   * Check if an element exists on the page.
   */
  protected async elementExists(selector: string): Promise<boolean> {
    const page = this.getPage();
    const element = await page.$(selector);
    return element !== null;
  }

  /**
   * Wait for the page to be fully loaded.
   */
  protected async waitForPageLoad(): Promise<void> {
    const page = this.getPage();
    await page.waitForFunction(() => document.readyState === 'complete');
  }

  /**
   * Common login validation - check if login was successful.
   * Override in subclass if the supplier has a different way to verify login.
   */
  protected async verifyLogin(successIndicatorSelector: string): Promise<boolean> {
    try {
      await this.waitForSelector(successIndicatorSelector, { timeout: 15000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Perform login with retry logic.
   */
  protected async performLoginWithRetry(
    credentials: SupplierCredentials,
    loginFn: () => Promise<void>,
    maxRetries = 2
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.log.debug({ attempt, maxRetries }, 'Login attempt');
        await loginFn();
        this.log.info('Login successful');
        this.credentials = credentials;
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.log.warn({ attempt, err: error }, 'Login attempt failed');

        try {
          await this.captureLoginDiagnostics(attempt, lastError);
        } catch (diagnosticError) {
          this.log.warn({ err: diagnosticError }, 'Failed to capture login diagnostics');
        }

        if (attempt < maxRetries) {
          await this.delay(2000, 5000);
          // Refresh page before retry
          await this.getPage().reload({ waitUntil: 'networkidle2' });
        }
      }
    }

    throw new LoginError(
      `Login failed after ${maxRetries} attempts: ${lastError?.message}`,
      this.supplierId
    );
  }

  /**
   * Scroll through the page to load lazy-loaded content.
   */
  protected async scrollToLoadAll(): Promise<void> {
    const page = this.getPage();
    await this.browserService.humanScroll(page);
  }

  /**
   * Parse price string to number.
   */
  protected parsePrice(priceStr: string): number {
    // Remove currency symbols, spaces, and convert comma to period
    const cleaned = priceStr
      .replace(/[€$£¥₹]/g, '')
      .replace(/\s/g, '')
      .replace(',', '.');

    const price = Number.parseFloat(cleaned);
    return Number.isNaN(price) ? 0 : price;
  }

  /**
   * Parse VAT rate from string (e.g., "23%" -> 23).
   */
  protected parseVatRate(vatStr: string): number {
    const match = vatStr.match(/(\d+(?:\.\d+)?)/);
    return match ? Number.parseFloat(match[1]) : 0;
  }
}
