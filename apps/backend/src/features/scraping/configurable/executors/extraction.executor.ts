import type { Page } from 'puppeteer';
import type { ScrapedProduct } from '../../scraping.types.js';
import type {
  ExtractionConfig,
  ExtractionStrategy,
  FieldExtraction,
} from '../types/config.types.js';
import type { RawProduct, TransformerMap } from '../types/transformer.types.js';

/**
 * Tokens that have no business inside a DOM-extraction snippet. If any appear
 * in a `compute` string, treat the definition as suspect and refuse to load
 * the scraper. This is a defence-in-depth guard, not a sandbox — `compute`
 * already runs inside the browser context (`page.evaluate`), but blocking
 * obvious escape attempts catches accidental misuse if someone ever wires
 * `compute` to a DB/HTTP source despite the contract documented on
 * `ComputedStrategy.compute`.
 */
const COMPUTE_FORBIDDEN_TOKENS = [
  'import(',
  'require(',
  'process.',
  'globalThis',
  'window.parent',
  'window.top',
  'fetch(',
  'XMLHttpRequest',
  'eval(',
  'Function(',
  'new Function',
  'document.cookie',
  'localStorage',
  'sessionStorage',
] as const;
const COMPUTE_MAX_LENGTH = 4000;

function assertSafeComputeString(compute: string, fieldKey: string): void {
  if (typeof compute !== 'string') {
    throw new Error(`Computed extractor for "${fieldKey}" must be a string`);
  }
  if (compute.length > COMPUTE_MAX_LENGTH) {
    throw new Error(
      `Computed extractor for "${fieldKey}" exceeds ${COMPUTE_MAX_LENGTH} chars — refuse to load`
    );
  }
  for (const token of COMPUTE_FORBIDDEN_TOKENS) {
    if (compute.includes(token)) {
      throw new Error(
        `Computed extractor for "${fieldKey}" contains forbidden token "${token}" — refuse to load`
      );
    }
  }
}

/**
 * Executes product extraction from page DOM.
 */
export class ExtractionExecutor {
  constructor(
    private extractionConfig: ExtractionConfig,
    private transformers: TransformerMap,
    private logPrefix = 'ExtractionExecutor'
  ) {
    // Validate every `compute` snippet at construction (i.e. at registry load
    // time). If a definition smuggles in something that doesn't look like
    // DOM extraction, fail fast before the scraper is even registered.
    for (const field of extractionConfig.fields) {
      for (const strategy of field.strategies) {
        if (strategy.type === 'computed') {
          assertSafeComputeString(strategy.compute, field.key);
        }
      }
    }
  }

  /**
   * Extract all products from the current page.
   */
  async extractProducts(page: Page): Promise<ScrapedProduct[]> {
    // First, extract raw data from page using page.evaluate
    const rawProducts = await this.extractRawProducts(page);

    // Then transform each raw product
    const products: ScrapedProduct[] = [];
    for (const raw of rawProducts) {
      const product = this.transformProduct(raw);
      if (product) {
        products.push(product);
      }
    }

    return products;
  }

  /**
   * Extract raw product data from page.
   */
  private async extractRawProducts(page: Page): Promise<RawProduct[]> {
    const { productContainer, fields } = this.extractionConfig;

    // Serialize the extraction config for use in page.evaluate
    const serializedFields = fields.map((f) => ({
      key: f.key,
      strategies: f.strategies.map((s) => {
        if (s.type === 'computed') {
          // Computed strategies use string function bodies
          return { type: 'computed' as const, compute: s.compute };
        }
        return s;
      }),
    }));

    const rawProducts = await page.$$eval(
      productContainer,
      (containers, fieldsConfig) => {
        return containers.map((container) => {
          const product: Record<string, unknown> = {};

          for (const field of fieldsConfig) {
            product[field.key] = null;

            for (const strategy of field.strategies) {
              let value: string | null = null;

              switch (strategy.type) {
                case 'inputValue': {
                  const input = container.querySelector(strategy.selector) as HTMLInputElement;
                  value = input?.value?.trim() || null;
                  // Apply pattern if specified
                  if (value && strategy.pattern) {
                    try {
                      const match = value.match(new RegExp(strategy.pattern));
                      value = match?.[1] ?? null;
                    } catch {
                      value = null;
                    }
                  }
                  break;
                }

                case 'textContent': {
                  const el = container.querySelector(strategy.selector);
                  if (el) {
                    if (strategy.excludeChild) {
                      // Clone and remove excluded child
                      const clone = el.cloneNode(true) as HTMLElement;
                      const toRemove = clone.querySelector(strategy.excludeChild);
                      toRemove?.remove();
                      value = clone.textContent?.trim() || null;
                    } else {
                      value = el.textContent?.trim() || null;
                    }
                  }
                  // Apply pattern if specified
                  if (value && strategy.pattern) {
                    try {
                      const match = value.match(new RegExp(strategy.pattern));
                      value = match?.[1] ?? null;
                    } catch {
                      value = null;
                    }
                  }
                  break;
                }

                case 'attribute': {
                  const el = container.querySelector(strategy.selector);
                  value = el?.getAttribute(strategy.attribute) || null;
                  // Apply pattern if specified
                  if (value && strategy.pattern) {
                    try {
                      const match = value.match(new RegExp(strategy.pattern));
                      value = match?.[1] ?? null;
                    } catch {
                      value = null;
                    }
                  }
                  break;
                }

                case 'computed': {
                  // Runs inside `page.evaluate` (browser sandbox). The string
                  // is validated at executor construction (see
                  // assertSafeComputeString) — never load it from runtime input.
                  try {
                    // biome-ignore lint/security/noGlobalEval: Required for dynamic extraction; input is validated at load time.
                    const fn = eval(`(container) => { ${strategy.compute} }`);
                    value = fn(container);
                  } catch {
                    value = null;
                  }
                  break;
                }
              }

              // If we found a value, use it and stop trying strategies
              if (value !== null && value !== '') {
                product[field.key] = value;
                break;
              }
            }
          }

          return product;
        });
      },
      serializedFields
    );

    return rawProducts;
  }

  /**
   * Transform raw product data to ScrapedProduct using transformers.
   */
  private transformProduct(raw: RawProduct): ScrapedProduct | null {
    const result: Partial<ScrapedProduct> = {};

    // Process each transformer
    for (const [key, transformer] of Object.entries(this.transformers)) {
      if (!transformer) continue;

      const rawValue = raw[key];

      // Validate
      if (!transformer.validate(rawValue)) {
        if (transformer.required) {
          // Required field failed validation - skip product
          return null;
        }
        // Use default if available
        if (transformer.default !== undefined) {
          (result as Record<string, unknown>)[key] = transformer.default;
        }
        continue;
      }

      // Transform
      const transformed = transformer.transform(rawValue);

      if (transformed === null) {
        if (transformer.required) {
          // Required field failed transformation - skip product
          return null;
        }
        // Use default if available
        if (transformer.default !== undefined) {
          (result as Record<string, unknown>)[key] = transformer.default;
        }
        continue;
      }

      (result as Record<string, unknown>)[key] = transformed;
    }

    const metadata: Record<string, unknown> = {};
    const imageUrl = (result as { imageUrl?: string }).imageUrl;
    if (imageUrl !== undefined) {
      metadata.imageUrl = imageUrl;
    }
    const productUrl = (result as { productUrl?: string }).productUrl;
    if (productUrl !== undefined) {
      metadata.productUrl = productUrl;
    }

    const coreKeys = new Set([
      'sku',
      'ean',
      'name',
      'price',
      'vatRate',
      'unitSize',
      'availability',
      'imageUrl',
      'productUrl',
    ]);
    for (const [key, value] of Object.entries(result)) {
      if (coreKeys.has(key) || value === undefined || value === null) {
        continue;
      }
      metadata[key] = value;
    }

    // Map to ScrapedProduct structure
    return {
      supplierProductCode: (result as { sku?: string }).sku ?? '',
      eanCode: (result as { ean?: string }).ean ?? '',
      name: (result as { name?: string }).name ?? 'Unknown Product',
      price: (result as { price?: number }).price ?? 0,
      vatRate: (result as { vatRate?: number }).vatRate,
      unitSize: (result as { unitSize?: string }).unitSize,
      availability:
        (result as { availability?: ScrapedProduct['availability'] }).availability ?? 'available',
      metadata,
    };
  }

  /**
   * Check if products are loaded on the current page.
   */
  async areProductsLoaded(page: Page): Promise<boolean> {
    const element = await page.$(this.extractionConfig.productsLoadedCheck);
    return element !== null;
  }
}
