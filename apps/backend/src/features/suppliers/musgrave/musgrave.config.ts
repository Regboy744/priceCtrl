/**
 * Musgrave Marketplace scraper configuration.
 *
 * This scraper uses a HYBRID approach:
 * - Puppeteer for LOGIN (to extract apiToken and pgId cookies)
 * - REST API for PRODUCT FETCHING (parallel requests for speed)
 *
 * Configuration is based on the proven approach from the original
 * mkpDataProcessing JavaScript service.
 */
export const MUSGRAVE_CONFIG = {
  // ============ URLs ============

  /** Base website URL */
  baseUrl: 'https://www.musgravemarketplace.ie',

  /** Login page URL with return URL parameter */
  loginUrl: 'https://www.musgravemarketplace.ie/login?returnUrl=%2Fhome',

  /** OAuth2 token endpoint (password grant) */
  tokenUrl:
    'https://www-api.musgravemarketplace.ie/INTERSHOP/rest/WFS/musgrave-MWPIRL-Site/-;loc=en_IE;cur=EUR/token',

  /** Personalization endpoint (returns pgId) */
  personalizationUrl:
    'https://www-api.musgravemarketplace.ie/INTERSHOP/rest/WFS/musgrave-MWPIRL-Site/-;loc=en_IE;cur=EUR/personalization',

  /**
   * API Base URL (INTERSHOP REST format with semicolons)
   * Note: This is different from the website URL
   */
  apiBaseUrl:
    'https://www-api.musgravemarketplace.ie/INTERSHOP/rest/WFS/musgrave-MWPIRL-Site/-;loc=en_IE;cur=EUR',

  // ============ API Configuration ============

  api: {
    /**
     * Products endpoint template.
     *
     * {pgId} is replaced with the user's personalization group ID.
     *
     * The old FoodService account exposed a flat product listing under the
     * root (`/RetailWebHierarchy/products`). The current retail account
     * (e.g. `241-rialto-store@centra.ie`) does NOT — it 404s at the root and
     * only serves products scoped to a specific `WebCat_XXX` node.
     *
     * TEMPORARY: testing flat-root RetailWebHierarchy for this account. If
     * this returns products we avoid category iteration entirely; if it
     * 404s we know iteration is required.
     */
    productsEndpoint: '/categories;spgid={pgId}/RetailWebHierarchy/products',

    /**
     * Product attributes to request from the API.
     *
     * Must include `UCIV` (per-consumer-unit cost incl VAT) — that's the
     * primary comparison field for the new unit-cost ranking. `RRP` + `POR`
     * are included for parity with the web UI so the full price context is
     * persisted.
     */
    attrs:
      'sku,salePrice,listPrice,availability,image,inStock,promotions,taxRate,size,isPromotionalPrice,UCIV,RRP,POR',

    /**
     * Attribute group name.
     *
     * The browser request uses `PRODUCT_API_ATTRIBUTES` — this is the group
     * that carries `number-of-pack-units`, `AdditionalEAN`, and
     * `GPC-category-code`. Our old value listed ATTRIBUTE NAMES, not a group
     * name, which is why `number-of-pack-units` never came through.
     */
    attributeGroup: 'PRODUCT_API_ATTRIBUTES',

    /**
     * Product filter type.
     */
    productFilter: 'fallback_searchquerydefinition',

    /**
     * Freight class filter.
     *   'CORE' — grocery/core products only (fast test runs, smaller catalog)
     *   ''     — no filter, full catalog (slower, matches browser request)
     *
     * Keeping 'CORE' as the default because test turnaround speed matters
     * day-to-day. Flip to '' when a full-catalog scrape is required.
     */
    freightClassId: 'CORE',

    /** Number of products per API request (page size) — matches browser. */
    pageSize: 72,

    /** Request timeout in milliseconds */
    requestTimeout: 30000,
  },

  // ============ Parallel Fetching Configuration ============

  parallel: {
    /**
     * Number of concurrent API requests.
     * Start with 10, will be reduced if rate limited.
     */
    concurrency: 20,

    /**
     * Delay between starting each parallel request (ms).
     * Staggers requests to avoid detection.
     */
    staggerDelay: 300,

    /** Minimum random delay added to each request (ms) */
    randomDelayMin: 100,

    /** Maximum random delay added to each request (ms) */
    randomDelayMax: 500,

    /** Delay between batch rounds (ms) */
    batchDelay: 2000,

    /** Random jitter added to batch delay (ms) */
    batchDelayJitter: 1000,

    /** Maximum retry count per batch */
    maxRetryCount: 3,

    /** Delay before retry (ms), multiplied by retry count */
    retryDelay: 5000,

    /**
     * Backoff time when rate limited (HTTP 429) in ms.
     * 60 seconds = 1 minute
     */
    rateLimitBackoff: 60000,

    /**
     * Stop fetching after this many consecutive empty batches.
     * Indicates we've reached the end of the product catalog.
     */
    emptyBatchThreshold: 2,

    /** Minimum concurrency (won't reduce below this) */
    minConcurrency: 2,
  },

  // ============ Database Configuration ============

  database: {
    /**
     * Batch size for database upserts.
     * Matches the BULK_LIMIT from the original project.
     */
    batchSize: 1000,

    /** Delay between database batches (ms) */
    batchDelay: 100,
  },

  // ============ Login Configuration ============

  login: {
    /** Navigation timeout (ms) */
    navigationTimeout: 30000,

    /** Element wait timeout (ms) */
    elementTimeout: 10000,

    /** Short element wait timeout (ms) */
    elementTimeoutShort: 5000,

    /** Cookie name for API token */
    apiTokenCookieName: 'apiToken',

    /** Cookie name for personalization group ID */
    pgIdCookieName: 'pgId',

    /** Maximum login retry attempts */
    maxRetries: 3,

    /** Delay between login retries (ms) */
    retryDelay: 2000,
  },

  // ============ Selectors (for Puppeteer login) ============

  selectors: {
    login: {
      /** OneTrust cookie consent button */
      cookieAcceptButton: '#onetrust-accept-btn-handler',

      /** Email/username input field */
      usernameInput: 'input[type="email"]',

      /** Password input field */
      passwordInput: 'input[type="password"]',

      /** Login submit button */
      submitButton: 'button[type="submit"][value="Login"]',

      /** Error message container */
      errorMessage: '.error-message, .alert-danger, .login-error',

      /** Success indicator (logged in state) */
      successIndicator: '.user-menu, .account-menu, .logged-in',
    },
  },

  // ============ Human Behavior Configuration ============

  human: {
    mouse: {
      /** Number of points in bezier curve for mouse movement */
      steps: 25,
      /** Minimum ms between mouse movement steps */
      minSpeed: 50,
      /** Maximum ms between mouse movement steps */
      maxSpeed: 150,
    },
    typing: {
      /** Minimum ms between keystrokes */
      minDelay: 50,
      /** Maximum ms between keystrokes */
      maxDelay: 150,
      /** Chance of making a typo (0.02 = 2%) */
      mistakeChance: 0.02,
    },
    scroll: {
      /** Minimum scroll distance in pixels */
      minDistance: 100,
      /** Maximum scroll distance in pixels */
      maxDistance: 300,
    },
  },

  // ============ API Attribute Names ============

  /**
   * Attribute names as they appear in the API response.
   * Used for extracting product data.
   */
  attributes: {
    sku: 'sku',
    inStock: 'inStock',
    image: 'image',
    listPrice: 'listPrice',
    salePrice: 'salePrice',
    isPromotionalPrice: 'isPromotionalPrice',
    availability: 'availability',
    taxRate: 'taxRate',
    size: 'size',
    additionalEAN: 'AdditionalEAN',
    gpcCategoryCode: 'GPC-category-code',
  },

  // ============ VAT Rate Mapping ============

  /**
   * Irish VAT rate codes to percentages.
   * S = Standard (23%), Z = Zero (0%), R1 = Reduced 1 (13.5%), R2 = Reduced 2 (9%)
   */
  vatRates: {
    S: 23,
    Z: 0,
    R1: 13.5,
    R2: 9,
    L: 0, // Livestock (exempt)
  } as Record<string, number>,
} as const;

export type MusgraveConfig = typeof MUSGRAVE_CONFIG;
