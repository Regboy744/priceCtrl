import type { Page } from 'puppeteer';
import type { ScrapedProduct } from '../../scraping/scraping.types.js';
import { VALUE_CENTRE_CONFIG } from './value-centre.config.js';
import type { ValueCentrePaginationInfo, ValueCentreRawProduct } from './value-centre.types.js';

export async function parseProductsFromPage(page: Page): Promise<ValueCentreRawProduct[]> {
  const { selectors } = VALUE_CENTRE_CONFIG;

  return page.evaluate((sel) => {
    const products: ValueCentreRawProduct[] = [];
    const productElements = document.querySelectorAll(sel.products.item);

    productElements.forEach((element) => {
      const getText = (selector: string): string | null => {
        const el = element.querySelector(selector);
        return el?.textContent?.trim() ?? null;
      };

      const getAttribute = (selector: string, attr: string): string | null => {
        const el = element.querySelector(selector);
        return el?.getAttribute(attr) ?? null;
      };

      products.push({
        name: getText(sel.products.name),
        price: getText(sel.products.price) ?? getAttribute(sel.products.price, 'data-price'),
        sku: getText(sel.products.sku) ?? getAttribute(sel.products.item, 'data-sku'),
        ean: getText(sel.products.ean) ?? getAttribute(sel.products.item, 'data-ean'),
        availability: getText(sel.products.availability),
        unitSize: getText(sel.products.unitSize),
        vatRate: getText(sel.products.vatRate),
        productUrl: element.querySelector('a')?.href ?? null,
      });
    });

    return products;
  }, selectors);
}

export async function parsePaginationInfo(page: Page): Promise<ValueCentrePaginationInfo> {
  const { selectors } = VALUE_CENTRE_CONFIG;

  return page.evaluate((sel) => {
    const currentPageEl = document.querySelector(sel.pagination.currentPage);
    const totalPagesEl = document.querySelector(sel.pagination.totalPages);
    const nextButton = document.querySelector(sel.pagination.nextButton);

    return {
      currentPage: Number.parseInt(currentPageEl?.textContent ?? '1', 10) || 1,
      totalPages: Number.parseInt(totalPagesEl?.textContent ?? '1', 10) || 1,
      hasNextPage: nextButton !== null && !nextButton.hasAttribute('disabled'),
    };
  }, selectors);
}

export function transformToScrapedProduct(raw: ValueCentreRawProduct): ScrapedProduct | null {
  if (!raw.ean || !raw.price) return null;

  const price = parsePrice(raw.price);
  if (price <= 0) return null;

  return {
    supplierProductCode: raw.sku ?? '',
    eanCode: raw.ean.replace(/\D/g, ''),
    name: raw.name ?? 'Unknown Product',
    price,
    vatRate: parseVatRate(raw.vatRate),
    unitSize: raw.unitSize ?? undefined,
    availability: mapAvailability(raw.availability),
    metadata: { productUrl: raw.productUrl ?? undefined },
  };
}

function parsePrice(priceStr: string | null): number {
  if (!priceStr) return 0;
  const cleaned = priceStr
    .replace(/[€$£EUR]/gi, '')
    .replace(/\s/g, '')
    .replace(',', '.');
  return Number.parseFloat(cleaned) || 0;
}

function parseVatRate(vatStr: string | null): number {
  if (!vatStr) return 0;
  const match = vatStr.match(/(\d+(?:\.\d+)?)/);
  return match ? Number.parseFloat(match[1]) : 0;
}

function mapAvailability(
  availability: string | null
): 'available' | 'out_of_stock' | 'discontinued' | 'unknown' {
  if (!availability) return 'unknown';
  const normalized = availability.toLowerCase();
  if (normalized.includes('in stock') || normalized.includes('available')) return 'available';
  if (normalized.includes('out of stock')) return 'out_of_stock';
  if (normalized.includes('discontinued')) return 'discontinued';
  return 'unknown';
}

export async function hasProductsLoaded(page: Page): Promise<boolean> {
  const { selectors } = VALUE_CENTRE_CONFIG;
  return page.evaluate((sel) => document.querySelectorAll(sel.products.item).length > 0, selectors);
}
