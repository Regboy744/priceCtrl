import type { Browser, LaunchOptions, Page } from 'puppeteer';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import UserAgent from 'user-agents';
import { env } from '../config/env.js';
import { ServiceUnavailableError } from '../errors/AppError.js';
import { createLogger } from './logger.service.js';
import type { ProxyCredentials } from './proxy/proxy.types.js';

const log = createLogger('BrowserService');

// Get the default export which has the proper methods
const puppeteer = puppeteerExtra.default ?? puppeteerExtra;

// Apply stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

// ======= Human Behavior Configuration =======
const HUMAN_CONFIG = {
  mouse: {
    steps: 25, // Number of points in mouse movement curve
    minSpeed: 50, // Minimum ms between mouse steps
    maxSpeed: 150, // Maximum ms between mouse steps
  },
  typing: {
    minDelay: 50, // Minimum ms between keystrokes
    maxDelay: 150, // Maximum ms between keystrokes
    mistakeChance: 0.02, // 2% chance of typo (then backspace)
  },
};

// ======= Resource Blocking - To avoid urls, types that slow dow the process and increase data transfer =======
const BLOCKED_PATTERNS = [
  // Google Analytics & Tag Manager (~450 KB)
  'googletagmanager.com',
  'google-analytics.com',
  'analytics.google.com',
  'gtag/js',

  // Google Ads & DoubleClick (~10 KB)
  'googleads.g.doubleclick.net',
  'stats.g.doubleclick.net',
  'google.com/pagead',
  'google.com/ccm/collect',

  // Google Maps (not needed for product data) (~100 KB)
  'maps.googleapis.com',

  // Facebook (~130 KB)
  'connect.facebook.net',
  'facebook.com/tr',

  // LinkedIn (~20 KB)
  'px.ads.linkedin.com',
  'snap.licdn.com',

  // Microsoft Clarity (~20 KB)
  'clarity.ms',

  // Recommendations engine (not needed)
  'richrelevance.com',

  // Simple Analytics
  'simpleanalyticscdn.com',

  // Fonts / icon kits / telemetry (not needed for scraping)
  'typekit.net',
  'fontawesome.com',
  'cloudflareinsights.com',
  'browser-update.org',

  // Large product image CDN (HTML still contains image URLs)
  'productimages.swords.apteancloud.com',
];
const BLOCKED_TYPES = ['image', 'font', 'media', 'stylesheet'];

// Some sites download images/fonts via fetch/xhr. Block by extension as well.
const BLOCKED_EXTENSIONS = [
  // Images
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.avif',
  '.ico',

  // Fonts
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',

  // Media
  '.mp4',
  '.webm',
  '.mp3',
  '.wav',
  '.m4a',
  '.mov',
] as const;

// Extra belt-and-suspenders blocking at the CDP layer.
// This can catch cases where requests bypass page-level interception (e.g. PWA/service worker flows).
const CDP_BLOCKED_URLS = [
  // Oreillys product images: external CDN + local upload directory
  '*swords.apteancloud.com/*',
  '*/~uldir/*',
] as const;

// ======= Utility Functions =======

/**
 * Returns a random number between min and max (inclusive)
 */
const randomBetween = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * Generates points along a bezier curve for natural mouse movement.
 * Real humans don't move mice in straight lines!
 */
const generateBezierCurve = (
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  steps: number
): { x: number; y: number }[] => {
  const points: { x: number; y: number }[] = [];

  // Create two random control points for the curve
  // This makes the mouse path curved, not straight
  const cp1x = startX + (endX - startX) * 0.25 + randomBetween(-50, 50);
  const cp1y = startY + (endY - startY) * 0.25 + randomBetween(-50, 50);
  const cp2x = startX + (endX - startX) * 0.75 + randomBetween(-50, 50);
  const cp2y = startY + (endY - startY) * 0.75 + randomBetween(-50, 50);

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;

    // Cubic bezier formula
    const x =
      (1 - t) ** 3 * startX +
      3 * (1 - t) ** 2 * t * cp1x +
      3 * (1 - t) * t ** 2 * cp2x +
      t ** 3 * endX;

    const y =
      (1 - t) ** 3 * startY +
      3 * (1 - t) ** 2 * t * cp1y +
      3 * (1 - t) * t ** 2 * cp2y +
      t ** 3 * endY;

    points.push({ x: Math.round(x), y: Math.round(y) });
  }

  return points;
};

export interface BrowserOptions {
  headless?: boolean;
  timeout?: number;
  /** When provided, the browser is launched through this proxy. */
  proxyCredentials?: ProxyCredentials;
}

export interface BrowserInstance {
  browser: Browser;
  close: () => Promise<void>;
}

/**
 * Service for managing Puppeteer browser instances.
 *
 * Supports two modes:
 * 1. Isolated browsers: Each scraper gets its own browser via createIsolatedBrowser()
 *    - True parallelism, no resource contention
 *    - Higher memory usage (~100-150MB per browser)
 *
 * 2. Shared browser (legacy): Single browser via getBrowser()
 *    - Lower memory usage
 *    - Resource contention between scrapers
 */
export class BrowserService {
  private browser: Browser | null = null;
  private isInitializing = false;
  private initPromise: Promise<Browser> | null = null;

  /** Track isolated browsers for cleanup on shutdown */
  private isolatedBrowsers: Set<Browser> = new Set();

  /**
   * Apply common page configuration for all pages we create.
   * Keep this centralized so request blocking + stealth headers stay consistent.
   */
  private async configurePage(page: Page, options?: BrowserOptions): Promise<void> {
    // Authenticate the page with proxy credentials (userpass mode).
    // Must happen before any navigation so that Chromium sends the
    // Proxy-Authorization header on every request from this page.
    if (options?.proxyCredentials?.requiresAuth) {
      await page.authenticate({
        username: options.proxyCredentials.username ?? '',
        password: options.proxyCredentials.password ?? '',
      });
    }

    // Prevent PWA/service-worker prefetching from downloading assets we don't need.
    await page.setBypassServiceWorker(true);

    // CDP-level blocking for problematic URL patterns (stronger than request interception).
    // Keep failures non-fatal: scraping can proceed even if CDP setup fails.
    try {
      const client = await page.target().createCDPSession();
      await client.send('Network.enable');
      await client.send('Network.setBlockedURLs', { urls: [...CDP_BLOCKED_URLS] });
    } catch {
      // Ignore
    }

    // Resource blocking to reduce proxy bandwidth.
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url().toLowerCase();
      const type = req.resourceType();

      if (BLOCKED_TYPES.includes(type)) {
        return req.abort();
      }

      if (BLOCKED_PATTERNS.some((pattern) => url.includes(pattern))) {
        return req.abort();
      }

      // Block common static asset extensions even when loaded via fetch/xhr.
      // Avoid parsing non-HTTP(S) URLs (data:, blob:, chrome-extension:, etc.).
      if (!url.startsWith('data:') && !url.startsWith('blob:')) {
        try {
          const parsed = new URL(url);
          const path = parsed.pathname.toLowerCase();
          if (BLOCKED_EXTENSIONS.some((ext) => path.endsWith(ext))) {
            return req.abort();
          }
        } catch {
          // If URL parsing fails, fall through and allow the request.
        }
      }

      return req.continue();
    });

    // Set timeout
    const timeout = options?.timeout ?? env.scraping.timeout;
    page.setDefaultTimeout(timeout);
    page.setDefaultNavigationTimeout(timeout);

    // Set extra headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    });

    // Override webdriver detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });
  }

  /**
   * Create an isolated browser instance for a specific scraper.
   * Each scraper should call this to get its own dedicated browser.
   *
   * @param scraperName - Name of the scraper (for logging)
   * @param options - Browser options
   * @returns Browser instance that the scraper owns and must close
   */
  async createIsolatedBrowser(scraperName: string, options?: BrowserOptions): Promise<Browser> {
    const proxyInfo = options?.proxyCredentials
      ? ` (proxy: ${options.proxyCredentials.serverArg})`
      : '';
    log.debug({ scraperName, proxyInfo }, 'Creating isolated browser');
    const browser = await this.launchBrowser(options);
    this.isolatedBrowsers.add(browser);
    log.debug({ scraperName }, 'Isolated browser created');
    return browser;
  }

  /**
   * Close an isolated browser instance.
   * Should be called by the scraper when it's done.
   */
  async closeIsolatedBrowser(browser: Browser, scraperName: string): Promise<void> {
    try {
      if (browser.connected) {
        await browser.close();
        log.debug({ scraperName }, 'Isolated browser closed');
      }
    } catch (error) {
      log.warn({ scraperName, err: error }, 'Error closing isolated browser');
    } finally {
      this.isolatedBrowsers.delete(browser);
    }
  }

  /**
   * Get or create a shared browser instance.
   * @deprecated Use createIsolatedBrowser() for scrapers to avoid resource contention.
   * Kept for backward compatibility with non-scraper code.
   */
  async getBrowser(options?: BrowserOptions): Promise<Browser> {
    // Return existing browser if available and connected
    if (this.browser?.connected) {
      return this.browser;
    }

    // If already initializing, wait for that to complete
    if (this.isInitializing && this.initPromise) {
      return this.initPromise;
    }

    // Create new browser
    this.isInitializing = true;
    this.initPromise = this.launchBrowser(options);

    try {
      this.browser = await this.initPromise;
      return this.browser;
    } finally {
      this.isInitializing = false;
      this.initPromise = null;
    }
  }

  /**
   * Launch a new browser instance with anti-detection measures.
   */
  private async launchBrowser(options?: BrowserOptions): Promise<Browser> {
    const headless = options?.headless ?? env.scraping.headless;

    // Generate random desktop user agent to match 1920x1080 viewport
    const userAgent = new UserAgent({ deviceCategory: 'desktop' });

    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      // Do not load images at all (biggest bandwidth saver for product grids)
      '--blink-settings=imagesEnabled=false',
      // Reduce proxy bandwidth: disable Chromium background network traffic
      '--disable-background-networking',
      '--disable-component-update',
      '--safebrowsing-disable-auto-update',
      '--disable-sync',
      '--disable-domain-reliability',
      '--metrics-recording-only',
      '--disable-default-apps',
      '--no-default-browser-check',
      '--no-service-autorun',
      '--disable-client-side-phishing-detection',
      '--no-zygote',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process,OptimizationGuideModelDownloading,AutofillServerCommunication,PasswordLeakDetection',
      `--user-agent=${userAgent.toString()}`,
    ];

    // Inject proxy server arg when credentials are provided.
    if (options?.proxyCredentials) {
      args.push(`--proxy-server=${options.proxyCredentials.serverArg}`);
    }

    const launchOptions: LaunchOptions = {
      executablePath: '/usr/bin/chromium',
      headless: !!headless,
      args,
      defaultViewport: {
        width: 1920,
        height: 1080,
      },
      ignoreDefaultArgs: ['--enable-automation'],
    };

    try {
      // Use puppeteer-extra for stealth
      const browser = await puppeteer.launch(launchOptions);
      log.debug('Browser launched successfully');
      return browser as unknown as Browser;
    } catch (error) {
      log.error({ err: error }, 'Failed to launch browser');
      throw new ServiceUnavailableError('Failed to launch browser');
    }
  }

  /**
   * Create a new page in a specific browser with common configurations.
   */
  async createPageInBrowser(browser: Browser, options?: BrowserOptions): Promise<Page> {
    const page = await browser.newPage();

    await this.configurePage(page, options);

    return page;
  }

  /**
   * Create a new page with common configurations.
   * @deprecated Use createPageInBrowser() with an isolated browser instead.
   */
  async createPage(options?: BrowserOptions): Promise<Page> {
    const browser = await this.getBrowser(options);
    const page = await browser.newPage();

    // Track response sizes during scraping if needed.
    // page.on('response', async (response) => {
    //   const headers = response.headers();
    //   const contentLength = parseInt(headers['content-length'] || '0');
    //   log.debug({ url: response.url().slice(0, 50), kb: (contentLength / 1024).toFixed(2) }, 'Response size');
    // });

    await this.configurePage(page, options);

    return page;
  }

  /**
   * Close a page safely.
   */
  async closePage(page: Page): Promise<void> {
    try {
      if (!page.isClosed()) {
        await page.close();
      }
    } catch (error) {
      log.warn({ err: error }, 'Error closing page');
    }
  }

  /**
   * Close the shared browser instance.
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        log.debug('Shared browser closed');
      } catch (error) {
        log.warn({ err: error }, 'Error closing shared browser');
      } finally {
        this.browser = null;
      }
    }
  }

  /**
   * Close all browsers (shared + isolated) - called on process shutdown.
   */
  async closeAllBrowsers(): Promise<void> {
    // Close isolated browsers
    const closePromises: Promise<void>[] = [];

    for (const browser of this.isolatedBrowsers) {
      closePromises.push(
        (async () => {
          try {
            if (browser.connected) {
              await browser.close();
            }
          } catch (error) {
            log.warn({ err: error }, 'Error closing isolated browser');
          }
        })()
      );
    }

    await Promise.all(closePromises);
    this.isolatedBrowsers.clear();
    log.debug('All isolated browsers closed');

    // Close shared browser
    await this.closeBrowser();
  }

  /**
   * Human-like delay to avoid detection.
   */
  async humanDelay(minMs = 500, maxMs = 2000): Promise<void> {
    const delay = randomBetween(minMs, maxMs);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Moves mouse to an element with human-like curved movement.
   */
  async humanMouseMove(page: Page, selector: string): Promise<void> {
    // Get current mouse position (or start from random position)
    const currentPosition = await page.evaluate(() => ({
      x: (window as unknown as { mouseX?: number }).mouseX || Math.random() * 500,
      y: (window as unknown as { mouseY?: number }).mouseY || Math.random() * 300,
    }));

    // Get target element position
    const element = await page.$(selector);
    if (!element) return;

    const box = await element.boundingBox();
    if (!box) return;

    // Target a random point within the element (not always the center)
    const targetX = box.x + randomBetween(5, Math.max(6, box.width - 5));
    const targetY = box.y + randomBetween(5, Math.max(6, box.height - 5));

    // Generate curved path
    const points = generateBezierCurve(
      currentPosition.x,
      currentPosition.y,
      targetX,
      targetY,
      HUMAN_CONFIG.mouse.steps
    );

    // Move through each point with variable speed
    for (const point of points) {
      await page.mouse.move(point.x, point.y);
      await new Promise((resolve) =>
        setTimeout(resolve, randomBetween(HUMAN_CONFIG.mouse.minSpeed, HUMAN_CONFIG.mouse.maxSpeed))
      );
    }

    // Store current position for next movement
    await page.evaluate(
      (x, y) => {
        (window as unknown as { mouseX: number; mouseY: number }).mouseX = x;
        (window as unknown as { mouseY: number }).mouseY = y;
      },
      targetX,
      targetY
    );
  }

  /**
   * Clicks an element with human-like behavior.
   * Moves mouse first, small pause, then click.
   */
  async humanClick(page: Page, selector: string): Promise<void> {
    // Move to element first
    await this.humanMouseMove(page, selector);

    // Small random pause before clicking (humans don't click instantly)
    await new Promise((resolve) => setTimeout(resolve, randomBetween(50, 200)));

    // Click
    await page.click(selector);

    // Small pause after click
    await this.humanDelay(100, 500);
  }

  /**
   * Human-like typing with variable speed and occasional mistakes.
   */
  async humanType(page: Page, selector: string, text: string): Promise<void> {
    // First move mouse to the input and click
    await this.humanMouseMove(page, selector);
    await new Promise((resolve) => setTimeout(resolve, randomBetween(100, 300)));
    await page.click(selector);
    await new Promise((resolve) => setTimeout(resolve, randomBetween(200, 400)));

    // Type each character with variable speed
    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Random chance of making a typo (makes it look more human)
      if (Math.random() < HUMAN_CONFIG.typing.mistakeChance && i > 0) {
        // Type a wrong character
        const wrongChar = String.fromCharCode(char.charCodeAt(0) + randomBetween(-1, 1));
        await page.keyboard.type(wrongChar);
        await new Promise((resolve) => setTimeout(resolve, randomBetween(100, 300)));

        // Backspace to fix it
        await page.keyboard.press('Backspace');
        await new Promise((resolve) => setTimeout(resolve, randomBetween(50, 150)));
      }

      // Type the correct character
      await page.keyboard.type(char);

      // Variable delay between keystrokes
      // Humans type faster in the middle of words, slower at the start
      let typeDelay = randomBetween(HUMAN_CONFIG.typing.minDelay, HUMAN_CONFIG.typing.maxDelay);

      // Pause longer after spaces (word boundaries)
      if (char === ' ' || char === '@' || char === '.') {
        typeDelay += randomBetween(50, 150);
      }

      await new Promise((resolve) => setTimeout(resolve, typeDelay));
    }
  }

  /**
   * Random micro-movements to simulate natural mouse behavior.
   * Humans don't keep their mouse perfectly still.
   */
  async humanMicroMovements(page: Page): Promise<void> {
    const movements = randomBetween(2, 5);

    for (let i = 0; i < movements; i++) {
      const currentPos = await page.evaluate(() => ({
        x: (window as unknown as { mouseX?: number }).mouseX || 500,
        y: (window as unknown as { mouseY?: number }).mouseY || 300,
      }));

      // Small random movements (5-20 pixels)
      const newX = currentPos.x + randomBetween(-20, 20);
      const newY = currentPos.y + randomBetween(-20, 20);

      await page.mouse.move(newX, newY);
      await new Promise((resolve) => setTimeout(resolve, randomBetween(100, 300)));
    }
  }

  /**
   * Scroll page to simulate human behavior.
   */
  async humanScroll(page: Page): Promise<void> {
    await page.evaluate(async () => {
      const scrollHeight = document.body.scrollHeight;
      let currentPosition = 0;

      while (currentPosition < scrollHeight) {
        const scrollAmount = Math.floor(Math.random() * 300) + 100;
        currentPosition += scrollAmount;
        window.scrollTo(0, Math.min(currentPosition, scrollHeight));
        await new Promise((r) => setTimeout(r, Math.random() * 200 + 100));
      }
    });
  }

  /**
   * Wait for navigation with retries.
   */
  async safeNavigate(
    page: Page,
    url: string,
    options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2' }
  ): Promise<void> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        await page.goto(url, {
          waitUntil: options?.waitUntil ?? 'networkidle2',
        });
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        log.warn({ attempt: i + 1, maxRetries, err: error }, 'Navigation attempt failed');
        await this.humanDelay(1000, 3000);
      }
    }

    throw lastError ?? new Error('Navigation failed');
  }
}

// Singleton instance
export const browserService = new BrowserService();

// Cleanup on process exit
process.on('SIGINT', async () => {
  log.info('Shutting down (SIGINT)');
  await browserService.closeAllBrowsers();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  log.info('Shutting down (SIGTERM)');
  await browserService.closeAllBrowsers();
  process.exit(0);
});
