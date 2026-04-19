import type { HumanBehaviorConfig } from '../../utils/human-behavior.js';
import type { TransformerMap } from './transformer.types.js';

// ============ Main Config ============

/**
 * Complete scraper configuration.
 * This defines everything needed to scrape a supplier website.
 */
export interface ScraperConfig {
  /** Supplier identification */
  supplier: SupplierMeta;

  /** Browser behavior settings */
  browser?: BrowserConfig;

  /** Authentication/Login configuration */
  auth: AuthConfig;

  /** Product navigation configuration */
  navigation: NavigationConfig;

  /** Product extraction configuration */
  extraction: ExtractionConfig;
}

/**
 * Supplier metadata.
 */
export interface SupplierMeta {
  /** Database name for lookup */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Base URL of the supplier website */
  baseUrl: string;
}

/**
 * Browser configuration.
 */
export interface BrowserConfig {
  /** Human-like behavior overrides */
  humanBehavior?: Partial<HumanBehaviorConfig>;
  /** Page load timeout in ms */
  pageLoadTimeout?: number;
  /** Navigation timeout in ms */
  navigationTimeout?: number;
  /** Element wait timeout in ms */
  elementTimeout?: number;
}

// ============ Auth Config ============

/**
 * Authentication configuration.
 */
export interface AuthConfig {
  /** URL of the login page */
  loginUrl: string;

  /** Ordered steps to perform login */
  steps: AuthStep[];

  /** Selectors that indicate successful login */
  successIndicators: string[];

  /** URLs to visit after login to establish session (e.g., department setup) */
  afterLoginUrls?: string[];
}

/**
 * A single authentication step.
 */
export type AuthStep =
  | NavigateStep
  | WaitForReadyStep
  | HandleCookiesStep
  | InputStep
  | ClickStep
  | WaitNavigationStep
  | DelayStep
  | MicroMovementsStep;

export interface NavigateStep {
  type: 'navigate';
  url: string;
}

export interface WaitForReadyStep {
  type: 'waitForReady';
  timeout?: number;
}

export interface HandleCookiesStep {
  type: 'handleCookies';
  /** Selectors for cookie accept buttons (tried in order) */
  selectors: string[];
}

export interface InputStep {
  type: 'input';
  /** Which credential field to fill */
  field: 'username' | 'password';
  /** Selector strategies to find the input (tried in order) */
  strategies: SelectorStrategy[];
}

export interface ClickStep {
  type: 'click';
  /** Selector strategies to find the button (tried in order) */
  strategies: SelectorStrategy[];
}

export interface WaitNavigationStep {
  type: 'waitNavigation';
  timeout?: number;
}

export interface DelayStep {
  type: 'delay';
  min: number;
  max: number;
}

export interface MicroMovementsStep {
  type: 'microMovements';
}

/**
 * Strategy for finding an element.
 */
export interface SelectorStrategy {
  method: 'byId' | 'byName' | 'byClass' | 'byPlaceholder' | 'byType' | 'byValue' | 'custom';
  selector: string;
}

// ============ Navigation Config ============

/**
 * Navigation configuration for product pages.
 */
export interface NavigationConfig {
  /** Category definitions */
  categories: CategoryDefinition[];

  /** URL template with placeholders: {id}, {department}, {prodgroup}, {page}, {pageSize} */
  urlTemplate: string;

  /** Items per page for {pageSize} placeholder */
  pageSize: number;

  /** How to determine total pages */
  pagination: PaginationConfig;

  /** Number of categories to scrape in parallel */
  concurrency: number;

  /** Delays between operations */
  delays: NavigationDelays;

  /** Multi-phase navigation (e.g., Ambient then Chilled departments) */
  phases?: NavigationPhase[];
}

/**
 * Category definition - flexible to support different URL patterns.
 */
export type CategoryDefinition =
  | SimpleCategoryDefinition
  | DepartmentCategoryDefinition
  | CustomCategoryDefinition;

export interface SimpleCategoryDefinition {
  /** Simple category ID */
  id: number | string;
}

export interface DepartmentCategoryDefinition {
  /** Department ID */
  department: number;
  /** Product group within department */
  prodgroup: number;
}

export interface CustomCategoryDefinition {
  /** Custom key-value pairs for URL template */
  [key: string]: string | number;
}

/**
 * How to detect pagination.
 */
export interface PaginationConfig {
  type: 'hidden-input' | 'url-params' | 'element-count' | 'none';
  /** Selector for hidden input containing total pages */
  selector?: string;
  /** Regex pattern to extract page number from URLs */
  paramPattern?: string;
}

/**
 * Delay configuration for navigation.
 */
export interface NavigationDelays {
  betweenPages: { min: number; max: number };
  betweenCategories: { min: number; max: number };
}

/**
 * A navigation phase for multi-department sites.
 */
export interface NavigationPhase {
  /** Phase name for logging */
  name: string;
  /** URL to visit to set up this phase (e.g., set department) */
  setupUrl: string;
  /** Categories to scrape in this phase */
  categories: CategoryDefinition[];
}

// ============ Extraction Config ============

/**
 * Product extraction configuration.
 */
export interface ExtractionConfig {
  /** Selector for each product container */
  productContainer: string;

  /** Selector to check if products loaded on page */
  productsLoadedCheck: string;

  /** Field extraction definitions */
  fields: FieldExtraction[];
}

/**
 * Definition for extracting a single field.
 */
export interface FieldExtraction {
  /** Field key in raw product object */
  key: string;
  /** Ordered extraction strategies (first success wins) */
  strategies: ExtractionStrategy[];
}

/**
 * Strategy for extracting field value from DOM.
 */
export type ExtractionStrategy =
  | InputValueStrategy
  | TextContentStrategy
  | AttributeStrategy
  | ComputedStrategy;

export interface InputValueStrategy {
  type: 'inputValue';
  selector: string;
  /** Regex pattern to extract value (capture group 1 is used) */
  pattern?: string;
}

export interface TextContentStrategy {
  type: 'textContent';
  selector: string;
  /** Child selector to exclude from text (e.g., remove price unit span) */
  excludeChild?: string;
  /** Regex pattern to extract value (capture group 1 is used) */
  pattern?: string;
}

export interface AttributeStrategy {
  type: 'attribute';
  selector: string;
  attribute: string;
  /** Regex pattern to extract value (capture group 1 is used) */
  pattern?: string;
}

export interface ComputedStrategy {
  type: 'computed';
  /**
   * Custom function body. Runs inside `page.evaluate` (browser sandbox), not Node.
   *
   * SECURITY CONTRACT: `compute` must originate from source-controlled supplier
   * definition modules under `src/features/suppliers/*`. Never load this string
   * from a database column, HTTP body, env var, or any other runtime input —
   * the value is `eval`'d in the browser context and would otherwise allow
   * page-side code execution + data exfiltration.
   *
   * Long term: replace with a typed extractor enum (e.g.
   * `{ type: 'pickNthTd', n: 2 }`) so no string evaluation is needed.
   */
  compute: string;
}

// ============ Complete Supplier Definition ============

/**
 * Complete supplier definition including config and transformers.
 * This is what gets registered in the scraper registry.
 */
export interface SupplierDefinition {
  config: ScraperConfig;
  transformers: TransformerMap;
}
