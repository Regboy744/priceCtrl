import type { Page } from 'puppeteer';
import type { BrowserService } from '../../../../shared/services/browser.service.js';
import { createLogger } from '../../../../shared/services/logger.service.js';
import { humanDelay } from '../../utils/human-behavior.js';
import type {
  CategoryDefinition,
  NavigationConfig,
  NavigationPhase,
  PaginationConfig,
} from '../types/config.types.js';

/**
 * Executes navigation through category pages.
 */
export class NavigationExecutor {
  private log;

  constructor(
    private browserService: BrowserService,
    private navConfig: NavigationConfig,
    private baseUrl: string,
    private logPrefix = 'NavigationExecutor'
  ) {
    this.log = createLogger(logPrefix);
  }

  /**
   * Get all phases to process.
   * If no phases defined, creates a single default phase with all categories.
   */
  getPhases(): NavigationPhase[] {
    if (this.navConfig.phases?.length) {
      return this.navConfig.phases;
    }

    // Single default phase with all categories
    return [
      {
        name: 'default',
        setupUrl: '',
        categories: this.navConfig.categories,
      },
    ];
  }

  /**
   * Navigate to phase setup URL if provided.
   */
  async setupPhase(page: Page, phase: NavigationPhase): Promise<void> {
    if (phase.setupUrl) {
      this.log.debug({ phase: phase.name, setupUrl: phase.setupUrl }, 'Setting up phase');
      const fullUrl = phase.setupUrl.startsWith('http')
        ? phase.setupUrl
        : `${this.baseUrl}${phase.setupUrl}`;
      await this.browserService.safeNavigate(page, fullUrl);
      await humanDelay(1500, 2500);
    }
  }

  /**
   * Build URL for a category and page number.
   */
  buildCategoryUrl(category: CategoryDefinition, pageNum: number): string {
    let url = this.navConfig.urlTemplate;

    // Replace {pageSize} and {page}
    url = url.replace('{pageSize}', String(this.navConfig.pageSize));
    url = url.replace('{page}', String(pageNum));

    // Replace category-specific placeholders
    if ('id' in category) {
      url = url.replace('{id}', String(category.id));
    }
    if ('department' in category) {
      url = url.replace('{department}', String(category.department));
    }
    if ('prodgroup' in category) {
      url = url.replace('{prodgroup}', String(category.prodgroup));
    }

    // Handle any other custom placeholders
    for (const [key, value] of Object.entries(category)) {
      url = url.replace(`{${key}}`, String(value));
    }

    // Prepend base URL if relative
    return url.startsWith('http') ? url : `${this.baseUrl}${url}`;
  }

  /**
   * Navigate to a category page.
   */
  async navigateToCategory(page: Page, category: CategoryDefinition, pageNum = 1): Promise<void> {
    const url = this.buildCategoryUrl(category, pageNum);
    this.log.debug(
      { categoryKey: this.getCategoryKey(category), pageNum, url },
      'Navigating to category'
    );
    await this.browserService.safeNavigate(page, url);
    await humanDelay(1500, 2500);
  }

  /**
   * Get total pages for current category.
   */
  async getTotalPages(page: Page): Promise<number> {
    const pagination = this.navConfig.pagination;

    switch (pagination.type) {
      case 'hidden-input':
        if (!pagination.selector) return 1;
        return this.getTotalPagesFromHiddenInput(page, pagination.selector);

      case 'url-params':
        if (!pagination.paramPattern) return 1;
        return this.getTotalPagesFromUrlParams(page, pagination.paramPattern);

      case 'element-count':
        if (!pagination.selector) return 1;
        return this.getTotalPagesFromElementCount(page, pagination.selector);

      case 'none':
        return 1;

      default:
        return 1;
    }
  }

  /**
   * Get total pages from hidden input element.
   */
  private async getTotalPagesFromHiddenInput(page: Page, selector: string): Promise<number> {
    try {
      const totalPages = await page.$eval(selector, (el) =>
        Number.parseInt((el as HTMLInputElement).value || '1', 10)
      );
      return totalPages > 0 ? totalPages : 1;
    } catch {
      return 1;
    }
  }

  /**
   * Get total pages by finding highest page number in pagination links.
   */
  private async getTotalPagesFromUrlParams(page: Page, patternStr: string): Promise<number> {
    try {
      const pattern = new RegExp(patternStr);
      const totalPages = await page.evaluate((patternSrc) => {
        const regex = new RegExp(patternSrc);
        const links = document.querySelectorAll('a[href*="page="]');
        let maxPage = 1;

        for (const link of links) {
          const href = link.getAttribute('href') || '';
          const match = href.match(regex);
          if (match?.[1]) {
            const pageNum = Number.parseInt(match[1], 10);
            if (pageNum > maxPage) maxPage = pageNum;
          }
        }

        return maxPage;
      }, pattern.source);

      return totalPages;
    } catch {
      return 1;
    }
  }

  /**
   * Get total pages by counting pagination elements.
   */
  private async getTotalPagesFromElementCount(page: Page, selector: string): Promise<number> {
    try {
      const count = await page.$$eval(selector, (els) => els.length);
      return count > 0 ? count : 1;
    } catch {
      return 1;
    }
  }

  /**
   * Check if products are loaded on the current page.
   */
  async areProductsLoaded(page: Page, selector: string): Promise<boolean> {
    const element = await page.$(selector);
    return element !== null;
  }

  /**
   * Get delay configuration.
   */
  getDelays(): {
    betweenPages: { min: number; max: number };
    betweenCategories: { min: number; max: number };
  } {
    return this.navConfig.delays;
  }

  /**
   * Get concurrency setting.
   */
  getConcurrency(): number {
    return this.navConfig.concurrency;
  }

  /**
   * Generate a unique key for a category (for logging/tracking).
   */
  getCategoryKey(category: CategoryDefinition): string {
    if ('id' in category) {
      return `cat-${category.id}`;
    }
    if ('department' in category && 'prodgroup' in category) {
      return `dept-${category.department}-grp-${category.prodgroup}`;
    }
    return `custom-${JSON.stringify(category)}`;
  }
}
