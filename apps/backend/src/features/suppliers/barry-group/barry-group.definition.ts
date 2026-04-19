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
export const BARRY_GROUP_CONFIG: ScraperConfig = {
  supplier: {
    name: 'Barry Group',
    displayName: 'Barry Group',
    baseUrl: 'https://ind.barrys.ie',
  },

  browser: {
    navigationTimeout: 30000,
    elementTimeout: 10000,
    pageLoadTimeout: 60000,
  },

  auth: {
    loginUrl: 'https://ind.barrys.ie/',
    steps: [
      { type: 'navigate', url: 'https://ind.barrys.ie/' },
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
          { method: 'byClass', selector: 'input.loginV2[type="text"]' },
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
    successIndicators: ['a[href*="logout"]', '.headChildLogout'],
    // After login, navigate to Ambient department to establish session
    afterLoginUrls: ['https://ind.barrys.ie/products/SetDetails.asp?Dept=6'],
  },

  navigation: {
    // Categories are defined per phase, not here
    categories: [],
    urlTemplate:
      '/products/list.asp?department={department}&prodgroup={prodgroup}&ItemPP={pageSize}&page={page}',
    pageSize: 60,
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
          { department: 6, prodgroup: 10 },
          { department: 6, prodgroup: 14 },
          { department: 6, prodgroup: 15 },
          { department: 6, prodgroup: 16 },
          { department: 6, prodgroup: 21 },
          { department: 6, prodgroup: 25 },
          { department: 6, prodgroup: 27 },
          { department: 6, prodgroup: 28 },
          { department: 6, prodgroup: 29 },
          { department: 6, prodgroup: 13 },
          { department: 6, prodgroup: 26 },
        ],
      },
      {
        name: 'Chilled',
        setupUrl: '/products/SetDetailsFV.asp?Dept=35',
        categories: [
          { department: 35, prodgroup: 2 },
          { department: 35, prodgroup: 3 },
          { department: 35, prodgroup: 4 },
          { department: 35, prodgroup: 5 },
          { department: 35, prodgroup: 6 },
          { department: 35, prodgroup: 7 },
          { department: 35, prodgroup: 8 },
          { department: 35, prodgroup: 9 },
        ],
      },
    ],
  },

  extraction: {
    productContainer: 'tr.lcell',
    productsLoadedCheck: 'tr.lcell',
    fields: [
      {
        key: 'sku',
        strategies: [{ type: 'inputValue', selector: 'input[name="product_code"]' }],
      },
      {
        key: 'name',
        strategies: [{ type: 'textContent', selector: 'a[onclick^="prodDetails"]' }],
      },
      {
        key: 'price',
        strategies: [
          {
            type: 'computed',
            compute: `
              const tds = container.querySelectorAll('td');
              return tds[2]?.textContent?.trim() || null;
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
              const divs = container.querySelectorAll('div[style*="float:right"]');
              for (const div of divs) {
                if (div.textContent?.includes('VAT Rate')) {
                  return div.textContent.trim();
                }
              }
              return null;
            `,
          },
        ],
      },
      {
        key: 'imageUrl',
        strategies: [{ type: 'attribute', selector: 'img#prod', attribute: 'src' }],
      },
      {
        // EAN extracted from image URL pattern: /{EAN}t.jpg (5+ digits)
        key: 'ean',
        strategies: [
          {
            type: 'attribute',
            selector: 'img#prod',
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
export const BARRY_GROUP_TRANSFORMERS: TransformerMap = {
  sku: stringTransformer({ required: false, default: '' }),
  // EAN is extracted via pattern in extraction config, just validate here
  ean: directEanTransformer({ required: true, minLength: 5 }),
  name: stringTransformer({ required: false, default: 'Unknown Product' }),
  price: priceTransformer,
  vatRate: vatRateTransformer(true), // Convert to decimal (23% -> 0.23)
  // Barry Group only shows available products
  availability: availabilityTransformer(
    {},
    {
      defaultWhenMissing: 'available',
      defaultWhenUnmapped: 'available',
    }
  ),
  imageUrl: urlTransformer(),
};
