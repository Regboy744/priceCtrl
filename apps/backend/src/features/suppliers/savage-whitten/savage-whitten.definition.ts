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
 * Savage & Whitten scraper configuration.
 *
 * This supplier uses a pure web scraping approach with robust element
 * finding strategies for the login form and product extraction.
 */
export const SAVAGE_WHITTEN_CONFIG: ScraperConfig = {
  supplier: {
    name: 'Savage & Whitten',
    displayName: 'Savage & Whitten',
    baseUrl: 'https://www.savageandwhitten.com',
  },

  browser: {
    navigationTimeout: 30000,
    elementTimeout: 10000,
    pageLoadTimeout: 60000,
  },

  auth: {
    loginUrl: 'https://www.savageandwhitten.com/login',
    steps: [
      { type: 'navigate', url: 'https://www.savageandwhitten.com/login' },
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
          'button[aria-label*="cookie"]',
          'button[aria-label*="Accept"]',
        ],
      },
      { type: 'waitForReady' },
      {
        type: 'input',
        field: 'username',
        strategies: [
          { method: 'byId', selector: '#login_email' },
          { method: 'byName', selector: 'input[name="Username"]' },
          { method: 'byClass', selector: 'input.form-control-user[type="text"]' },
        ],
      },
      { type: 'delay', min: 300, max: 700 },
      { type: 'microMovements' },
      {
        type: 'input',
        field: 'password',
        strategies: [
          { method: 'byType', selector: 'input[type="password"]' },
          { method: 'byPlaceholder', selector: 'input[placeholder*="Password" i]' },
          { method: 'byName', selector: 'input[name="password"]' },
        ],
      },
      { type: 'delay', min: 500, max: 1200 },
      { type: 'microMovements' },
      {
        type: 'click',
        strategies: [
          { method: 'byId', selector: '#Js-login' },
          { method: 'byId', selector: '#js-login' },
          { method: 'byId', selector: '#login-btn' },
          { method: 'byValue', selector: 'input[value="Login"]' },
          { method: 'byValue', selector: 'input[value="login"]' },
          { method: 'byClass', selector: '.c-btn-yellow' },
          { method: 'byClass', selector: '.login-btn' },
        ],
      },
      { type: 'waitNavigation', timeout: 30000 },
      { type: 'delay', min: 1500, max: 2500 },
    ],
    successIndicators: ['a[href*="logout"]', '.user-menu', '.account-menu', '.logged-in'],
    afterLoginUrls: [],
  },

  navigation: {
    categories: [
      { id: 104 },
      { id: 100 },
      { id: 102 },
      { id: 99 },
      { id: 101 },
      { id: 103 },
      { id: 106 },
      { id: 108 },
    ],
    urlTemplate: '/ambient-products/{id}/?pagesize={pageSize}&page={page}',
    pageSize: 300,
    concurrency: 10,
    pagination: {
      type: 'hidden-input',
      selector: '#desktopPageCount',
    },
    delays: {
      betweenPages: { min: 1000, max: 3000 },
      betweenCategories: { min: 1000, max: 2000 },
    },
  },

  extraction: {
    productContainer: '#js-resultsContainer form.c-product-item-card',
    productsLoadedCheck: '#js-resultsContainer form.c-product-item-card',
    fields: [
      {
        key: 'sku',
        strategies: [
          { type: 'inputValue', selector: 'input[name="productCode"]' },
          { type: 'textContent', selector: 'p.u-align-right._product-code' },
        ],
      },
      {
        key: 'internal_product_id',
        strategies: [{ type: 'inputValue', selector: 'input[name="productId"]' }],
      },
      {
        key: 'name',
        strategies: [{ type: 'textContent', selector: 'p._product-name' }],
      },
      {
        key: 'price',
        strategies: [{ type: 'textContent', selector: 'p._product-price', excludeChild: 'span' }],
      },
      {
        key: 'unitSize',
        strategies: [
          {
            type: 'textContent',
            selector: 'div._product-info div.o-grid p.o-grid__item._product-size',
          },
        ],
      },
      {
        key: 'availability',
        strategies: [
          { type: 'textContent', selector: 'div._product-info p.u-text-small.u-c-red2' },
          { type: 'textContent', selector: 'div._product-info p.u-text-small.u-c-sw-yellow' },
        ],
      },
      {
        key: 'imageUrl',
        strategies: [
          { type: 'attribute', selector: 'a[href^="/product-detail"] img', attribute: 'src' },
        ],
      },
      {
        key: 'productUrl',
        strategies: [
          { type: 'attribute', selector: 'a[href^="/product-detail"]', attribute: 'href' },
        ],
      },
      {
        // EAN extracted from image URL pattern: /ProductImages/{EAN}_{SKU}_{hash}.png
        key: 'ean',
        strategies: [
          {
            type: 'attribute',
            selector: 'a[href^="/product-detail"] img',
            attribute: 'src',
            pattern: '/ProductImages/(\\d{8,14})_',
          },
        ],
      },
    ],
  },
};

/**
 * Savage & Whitten transformer configuration.
 */
export const SAVAGE_WHITTEN_TRANSFORMERS: TransformerMap = {
  sku: stringTransformer({ required: false, default: '' }),
  internal_product_id: stringTransformer({ required: false }),
  // EAN is extracted via pattern in extraction config, just validate here
  ean: directEanTransformer({ required: true, minLength: 8 }),
  name: stringTransformer({ required: false, default: 'Unknown Product' }),
  price: priceTransformer,
  vatRate: vatRateTransformer(false), // Keep as percentage
  unitSize: stringTransformer({ required: false }),
  availability: availabilityTransformer(
    {
      available: 'available',
      'in stock': 'available',
      'low stock': 'available',
      'while stocks last': 'available',
      'out of stock': 'out_of_stock',
      unavailable: 'out_of_stock',
      'currently unavailable': 'out_of_stock',
      'not available': 'out_of_stock',
      discontinued: 'discontinued',
      delisted: 'discontinued',
    },
    {
      defaultWhenMissing: 'available',
      defaultWhenUnmapped: 'unknown',
    }
  ),
  imageUrl: urlTransformer({ baseUrl: 'https://www.savageandwhitten.com' }),
  productUrl: urlTransformer({ baseUrl: 'https://www.savageandwhitten.com' }),
};
