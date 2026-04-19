import type { ElementHandle, Page } from 'puppeteer';
import type { BrowserService } from '../../../../shared/services/browser.service.js';
import { createLogger } from '../../../../shared/services/logger.service.js';
import type { SupplierCredentials } from '../../../../shared/services/vault.service.js';
import {
  DEFAULT_HUMAN_CONFIG,
  type HumanBehaviorConfig,
  clearAndFillInput,
  clickElement,
  humanDelay,
  microMovements,
  waitForPageReady,
} from '../../utils/human-behavior.js';
import type {
  AuthConfig,
  AuthStep,
  BrowserConfig,
  SelectorStrategy,
} from '../types/config.types.js';

/**
 * Executes authentication flow from configuration.
 */
export class AuthExecutor {
  private humanConfig: HumanBehaviorConfig;
  private log;

  constructor(
    private browserService: BrowserService,
    private authConfig: AuthConfig,
    browserConfig?: BrowserConfig,
    private logPrefix = 'AuthExecutor'
  ) {
    this.humanConfig = {
      ...DEFAULT_HUMAN_CONFIG,
      ...browserConfig?.humanBehavior,
    };
    this.log = createLogger(logPrefix);
  }

  /**
   * Execute the complete login flow.
   */
  async execute(page: Page, credentials: SupplierCredentials): Promise<void> {
    this.log.debug('Starting login flow');

    for (const step of this.authConfig.steps) {
      await this.executeStep(page, step, credentials);
    }

    // Verify login success
    const success = await this.verifyLogin(page);
    if (!success) {
      throw new Error('Login verification failed - no success indicators found');
    }

    // Execute post-login setup URLs
    if (this.authConfig.afterLoginUrls?.length) {
      for (const url of this.authConfig.afterLoginUrls) {
        this.log.debug({ url }, 'Post-login navigation');
        await this.browserService.safeNavigate(page, url);
        await humanDelay(1500, 2500);
      }
    }

    this.log.info('Login successful');
  }

  /**
   * Execute a single authentication step.
   */
  private async executeStep(
    page: Page,
    step: AuthStep,
    credentials: SupplierCredentials
  ): Promise<void> {
    switch (step.type) {
      case 'navigate':
        this.log.debug({ url: step.url }, 'Navigating to URL');
        await this.browserService.safeNavigate(page, step.url);
        break;

      case 'waitForReady':
        this.log.debug('Waiting for page ready');
        await waitForPageReady(page, step.timeout);
        break;

      case 'handleCookies':
        await this.handleCookies(page, step.selectors);
        break;

      case 'input':
        await this.handleInput(page, step.field, step.strategies, credentials);
        break;

      case 'click':
        await this.handleClick(page, step.strategies);
        break;

      case 'waitNavigation':
        this.log.debug('Waiting for navigation');
        try {
          await page.waitForNavigation({
            waitUntil: 'networkidle2',
            timeout: step.timeout ?? 30000,
          });
        } catch {
          this.log.warn('Navigation timeout - continuing');
        }
        break;

      case 'delay':
        await humanDelay(step.min, step.max);
        break;

      case 'microMovements':
        await microMovements(page);
        break;
    }
  }

  /**
   * Handle cookie consent popup.
   */
  private async handleCookies(page: Page, selectors: string[]): Promise<void> {
    await humanDelay(500, 1000);

    try {
      for (const selector of selectors) {
        const button = await page.$(selector);
        if (button) {
          this.log.debug({ selector }, 'Found cookie popup, accepting');
          await clickElement(page, button, this.humanConfig.mouse);
          await humanDelay(1000, 2000);
          this.log.debug('Cookie consent accepted');
          return;
        }
      }
      this.log.debug('No cookie popup found');
    } catch {
      this.log.debug('Cookie popup handling skipped');
    }
  }

  /**
   * Handle input field filling.
   */
  private async handleInput(
    page: Page,
    field: 'username' | 'password',
    strategies: SelectorStrategy[],
    credentials: SupplierCredentials
  ): Promise<void> {
    this.log.debug({ field }, 'Looking for input field');

    const element = await this.findElement(page, strategies);
    if (!element) {
      throw new Error(`${field} field not found with any strategy`);
    }

    this.log.debug({ field }, 'Input field found');
    await microMovements(page);
    await humanDelay(500, 1000);

    const value = field === 'username' ? credentials.username : credentials.password;
    await clearAndFillInput(page, element, value, this.humanConfig);

    this.log.debug({ field }, 'Input entered');
  }

  /**
   * Handle button click.
   */
  private async handleClick(page: Page, strategies: SelectorStrategy[]): Promise<void> {
    this.log.debug('Looking for button');

    const element = await this.findElement(page, strategies);
    if (!element) {
      throw new Error('Button not found with any strategy');
    }

    this.log.debug('Button found, clicking');
    await clickElement(page, element, this.humanConfig.mouse);
  }

  /**
   * Find element using multiple strategies.
   */
  private async findElement(
    page: Page,
    strategies: SelectorStrategy[]
  ): Promise<ElementHandle<Element> | null> {
    for (const strategy of strategies) {
      const selector = this.buildSelector(strategy);
      const element = await page.$(selector);
      if (element) {
        this.log.debug({ method: strategy.method, selector }, 'Found element');
        return element;
      }
    }
    return null;
  }

  /**
   * Build CSS selector from strategy.
   */
  private buildSelector(strategy: SelectorStrategy): string {
    // For all methods, we use the selector directly
    // The method is just for logging/organization
    return strategy.selector;
  }

  /**
   * Verify login was successful.
   */
  private async verifyLogin(page: Page): Promise<boolean> {
    await humanDelay(500, 1000);

    // Check if any success indicator is present
    for (const indicator of this.authConfig.successIndicators) {
      const element = await page.$(indicator);
      if (element) {
        this.log.debug({ indicator }, 'Login verified via indicator');
        return true;
      }
    }

    // Check URL changed from login page
    const currentUrl = page.url();
    if (!currentUrl.includes('login') && !currentUrl.endsWith('/')) {
      this.log.debug({ currentUrl }, 'Login verified via URL change');
      return true;
    }

    // Check for session cookies
    const cookies = await page.cookies();
    if (cookies.length > 2) {
      this.log.debug({ cookieCount: cookies.length }, 'Login verified via session cookies');
      return true;
    }

    return false;
  }
}
