/**
 * O'Reillys Wholesale scraper configuration.
 */
export const OREILLYS_CONFIG = {
  baseUrl: 'https://order.oreillyswholesale.com',
  loginUrl: 'https://order.oreillyswholesale.com/mainlogin.asp',
  productsUrl: 'https://order.oreillyswholesale.com/products/gridlist.asp',

  /** Department codes to scrape */
  departments: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11],

  loginTimeout: 30000,
  pageLoadTimeout: 60000,

  delayBetweenPages: { min: 1000, max: 3000 },
  delayBetweenActions: { min: 500, max: 1500 },

  selectors: {
    login: {
      usernameInput: '#username, input[name="username"]',
      passwordInput: '#password, input[name="password"], input[type="password"]',
      submitButton: 'input.LoginSubmitBTN, input[value="LOGIN"], input[type="submit"]',
      errorMessage: '.error-message, .alert-danger',
      successIndicator: 'a[href*="logout"], #searchRight > h2:first-child',
    },
    products: {
      container: 'table.ProductBox',
      item: 'table.ProductBox',
      name: 'td.ProdDetails[colspan="2"] a',
      price: '.PromoPrice, .StdPrice',
      sku: 'input[name="product_code"]',
      ean: '.product-ean, .ean',
      availability: '.availability, .stock-status',
      unitSize: '.unit-size, .pack-size',
      vatRate: 'td.ProdDetails',
    },
    pagination: {
      nextButton: 'a.next, a[rel="next"], .pagination-next, .next-page',
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

export type OreillysConfig = typeof OREILLYS_CONFIG;
