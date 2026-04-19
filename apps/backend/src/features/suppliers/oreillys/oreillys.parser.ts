import type { Page } from 'puppeteer';
import type { ScrapedProduct } from '../../scraping/scraping.types.js';
import { OREILLYS_CONFIG } from './oreillys.config.js';
import type { OreillysPaginationInfo, OreillysRawProduct } from './oreillys.types.js';

export async function parseProductsFromPage(page: Page): Promise<OreillysRawProduct[]> {
  const { selectors } = OREILLYS_CONFIG;

  return page.evaluate((sel) => {
    const products: OreillysRawProduct[] = [];
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

export async function parsePaginationInfo(page: Page): Promise<OreillysPaginationInfo> {
  const { selectors } = OREILLYS_CONFIG;

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

export function transformToScrapedProduct(raw: OreillysRawProduct): ScrapedProduct | null {
  if (!raw.ean || !raw.price) return null;

  const price = parsePrice(raw.price);
  if (price <= 0) return null;

  // Build metadata. `ScrapedProduct.metadata` is the channel scraping.service
  // reads from when inserting to supplier_products.
  const metadata: Record<string, unknown> = {};
  if (raw.productUrl) metadata.productUrl = raw.productUrl;
  if (raw.pack?.unitCostInclVat != null) metadata.unit_cost_incl_vat = raw.pack.unitCostInclVat;
  if (raw.pack?.packCount != null) metadata.pack_count = raw.pack.packCount;
  if (raw.pack?.packUnitSize) metadata.pack_unit_size = raw.pack.packUnitSize;

  return {
    supplierProductCode: raw.sku ?? '',
    eanCode: raw.ean.replace(/\D/g, ''),
    name: raw.name ?? 'Unknown Product',
    price,
    vatRate: parseVatRate(raw.vatRate),
    unitSize: raw.unitSize ?? undefined,
    availability: mapAvailability(raw.availability),
    metadata,
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
  if (!match) return 0;
  const pct = Number.parseFloat(match[1]);
  return pct / 100; // Convert to decimal (23% → 0.23)
}

function mapAvailability(
  availability: string | null
): 'available' | 'out_of_stock' | 'discontinued' | 'unknown' {
  const normalized = availability?.toLowerCase() ?? '';
  if (normalized.includes('in stock')) return 'available';
  if (normalized.includes('discontinued')) return 'discontinued';
  return 'out_of_stock';
}

export async function hasProductsLoaded(page: Page): Promise<boolean> {
  const { selectors } = OREILLYS_CONFIG;
  return page.evaluate((sel) => document.querySelectorAll(sel.products.item).length > 0, selectors);
}
