/**
 * Value Centre scraper configuration.
 */
export const VALUE_CENTRE_CONFIG = {
  baseUrl: 'https://www.valuecentre.ie',
  loginUrl: 'https://www.valuecentre.ie/login',
  productsUrl: 'https://www.valuecentre.ie/products',

  loginTimeout: 30000,
  pageLoadTimeout: 60000,

  delayBetweenPages: { min: 1000, max: 3000 },
  delayBetweenActions: { min: 500, max: 1500 },

  selectors: {
    login: {
      usernameInput: '#username, input[name="username"], input[type="email"]',
      passwordInput: '#password, input[name="password"], input[type="password"]',
      submitButton: 'button[type="submit"], input[type="submit"]',
      errorMessage: '.error-message, .alert-danger',
      successIndicator: '.user-menu, .account-menu, .logged-in',
    },
    products: {
      container: '.product-list, .products-container',
      item: '.product-item, .product-card',
      name: '.product-name, .product-title',
      price: '.product-price, .price',
      sku: '.product-sku, .sku',
      ean: '.product-ean, .ean',
      availability: '.availability, .stock-status',
      unitSize: '.unit-size, .pack-size',
      vatRate: '.vat-rate',
    },
    pagination: {
      nextButton: '.pagination-next, .next-page',
      pageNumbers: '.pagination-number',
      currentPage: '.pagination-current',
      totalPages: '.pagination-total',
    },
  },

  availabilityMap: {
    'in stock': 'available',
    available: 'available',
    'out of stock': 'out_of_stock',
    unavailable: 'out_of_stock',
    discontinued: 'discontinued',
  } as Record<string, 'available' | 'out_of_stock' | 'discontinued' | 'unknown'>,
} as const;

export type ValueCentreConfig = typeof VALUE_CENTRE_CONFIG;
