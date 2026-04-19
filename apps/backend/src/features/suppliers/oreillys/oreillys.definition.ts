import type { ScraperConfig, TransformerMap } from '../../scraping/configurable/index.js';
import {
  availabilityTransformer,
  directEanTransformer,
  priceTransformer,
  stringTransformer,
  urlTransformer,
  vatRateTransformer,
} from '../../scraping/configurable/index.js';

/**
 * Barry Group scraper configuration.
 *
 * This supplier uses a pure web scraping approach with robust element
 * finding strategies. It has two departments (Ambient and Chilled) that
 * require separate session setup.
 */
export const OREILLYS_CONFIG: ScraperConfig = {
  supplier: {
    name: "O'Reillys Wholesale",
    displayName: "O'Reillys Wholesale",
    baseUrl: 'https://order.oreillyswholesale.com',
  },

  browser: {
    navigationTimeout: 30000,
    elementTimeout: 10000,
    pageLoadTimeout: 60000,
  },

  auth: {
    loginUrl: 'https://order.oreillyswholesale.com/mainlogin.asp',
    steps: [
      { type: 'navigate', url: 'https://order.oreillyswholesale.com/mainlogin.asp' },
      { type: 'delay', min: 1000, max: 2000 },
      { type: 'microMovements' },
      {
        type: 'handleCookies',
        selectors: [
          '#onetrust-accept-btn-handler',
          '.cookie-accept',
          '[data-cookie-accept]',
          '#accept-cookies',
          '.accept-cookies-btn',
          'button[aria-label*="cookie" i]',
          'button[aria-label*="Accept" i]',
        ],
      },
      { type: 'waitForReady' },
      {
        type: 'input',
        field: 'username',
        strategies: [
          { method: 'byId', selector: 'input#username' },
          { method: 'byName', selector: 'input[name="username"]' },
          // { method: 'byClass', selector: 'input.loginV2[type="text"]' },
          { method: 'byPlaceholder', selector: 'input[placeholder*="Username" i]' },
        ],
      },
      { type: 'delay', min: 300, max: 700 },
      { type: 'microMovements' },
      {
        type: 'input',
        field: 'password',
        strategies: [
          { method: 'byId', selector: 'input#password' },
          { method: 'byName', selector: 'input[name="password"]' },
          { method: 'byType', selector: 'input[type="password"]' },
          { method: 'byPlaceholder', selector: 'input[placeholder*="Password" i]' },
        ],
      },
      { type: 'delay', min: 500, max: 1200 },
      { type: 'microMovements' },
      {
        type: 'click',
        strategies: [
          { method: 'byClass', selector: 'input.LoginSubmitBTN' },
          { method: 'byValue', selector: 'input[value="LOGIN"]' },
          { method: 'byType', selector: 'input[type="submit"]' },
        ],
      },
      { type: 'waitNavigation', timeout: 30000 },
      { type: 'delay', min: 1500, max: 2500 },
    ],
    successIndicators: ['a[href*="logout"]', '#searchRight > h2:first-child'],
    // After login, navigate to Ambient department to establish session
    afterLoginUrls: [],
  },

  navigation: {
    // Categories are defined per phase, not here
    categories: [],
    urlTemplate: '/products/gridlist.asp?DeptCode={department}&page={page}',
    pageSize: 60, // This supplier does not have page size option
    concurrency: 10,
    pagination: {
      type: 'url-params',
      paramPattern: 'page=(\\d+)',
    },
    delays: {
      betweenPages: { min: 1000, max: 3000 },
      betweenCategories: { min: 1000, max: 2000 },
    },
    // Two-phase scraping: Ambient then Chilled
    phases: [
      {
        name: 'Ambient',
        setupUrl: '', // Already set up via afterLoginUrls
        categories: [
          { department: 2 },
          { department: 3 },
          { department: 4 },
          { department: 5 },
          { department: 6 },
          { department: 7 },
          { department: 8 },
          { department: 9 },
          { department: 10 },
          { department: 11 },
        ],
      },
    ],
  },

  extraction: {
    productContainer: 'table.ProductBox',
    productsLoadedCheck: 'table.ProductBox',
    fields: [
      {
        key: 'sku',
        strategies: [{ type: 'inputValue', selector: 'input[name="product_code"]' }],
      },
      {
        key: 'name',
        strategies: [
          {
            type: 'computed',
            compute: `
              // Find the td with height:50px style that contains the product name link
              const tds = container.querySelectorAll('td.ProdDetails[colspan="2"]');
              for (const td of tds) {
                if (td.style.height === '50px' || td.getAttribute('style')?.includes('height:50px')) {
                  const link = td.querySelector('a');
                  if (link) return link.textContent?.trim() || null;
                }
              }
              return null;
            `,
          },
        ],
      },
      {
        key: 'price',
        strategies: [
          {
            type: 'computed',
            compute: `
              // Prefer PromoPrice over StdPrice
              const promo = container.querySelector('.PromoPrice');
              if (promo) return promo.textContent?.trim() || null;
              const std = container.querySelector('.StdPrice');
              if (std) return std.textContent?.trim() || null;
              return null;
            `,
          },
        ],
      },
      {
        key: 'vatRate',
        strategies: [
          {
            type: 'computed',
            compute: `
              // Find td containing "VAT" text
              const tds = container.querySelectorAll('td.ProdDetails');
              for (const td of tds) {
                const text = td.textContent || '';
                if (text.includes('VAT')) {
                  return text.trim();
                }
              }
              return null;
            `,
          },
        ],
      },
      {
        key: 'availability',
        strategies: [{ type: 'textContent', selector: '.OKStatus, .NoStock, .DueIn' }],
      },
      {
        key: 'imageUrl',
        strategies: [{ type: 'attribute', selector: 'img[id="prod"]', attribute: 'src' }],
      },
      {
        // EAN extracted from image URL pattern: /{EAN}t.jpg (5+ digits)
        // Only works for external URLs with valid EANs - products with local images will be filtered out
        key: 'ean',
        strategies: [
          {
            type: 'attribute',
            selector: 'img[id="prod"]',
            attribute: 'src',
            pattern: '(\\d{5,14})t\\.jpg',
          },
        ],
      },
    ],
  },
};

/**
 * Barry Group transformer configuration.
 */
export const OREILLYS_TRANSFORMERS: TransformerMap = {
  sku: stringTransformer({ required: false, default: '' }),
  // EAN is extracted via pattern in extraction config, just validate here
  ean: directEanTransformer({ required: true, minLength: 5 }),
  name: stringTransformer({ required: false, default: 'Unknown Product' }),
  price: priceTransformer,
  vatRate: vatRateTransformer(true), // Convert to decimal (23% -> 0.23)
  // Listing surfaces stock state via `.OKStatus` ("In Stock"), `.NoStock`
  // ("NO STOCK"), or `.DueIn` ("Due DD/MM/YY"). Rule: only "in stock" counts
  // as available; any other text (or missing) means it can't be ordered now.
  availability: availabilityTransformer(
    {
      'in stock': 'available',
      discontinued: 'discontinued',
      delisted: 'discontinued',
    },
    {
      defaultWhenMissing: 'out_of_stock',
      defaultWhenUnmapped: 'out_of_stock',
    }
  ),
  imageUrl: urlTransformer(),
};
