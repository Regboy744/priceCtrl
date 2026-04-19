/**
 * Musgrave Marketplace API Service
 *
 * Handles all API interactions with the Musgrave Marketplace:
 * - Token decoding
 * - URL building
 * - Parallel fetching with rate limiting
 * - Error handling (401, 429)
 *
 * This is based on the proven approach from saveMKPDataDb.js
 */

import { createLogger } from '../../../shared/services/logger.service.js';
import { MUSGRAVE_CONFIG } from './musgrave.config.js';
import type {
  MusgraveApiProduct,
  MusgraveApiResponse,
  MusgraveAuthTokens,
  MusgraveBatchCallback,
  MusgraveFetchStats,
  MusgravePageFetchResult,
  MusgravePersonalizationResponse,
  MusgraveReauthCallback,
  MusgraveTokenResponse,
} from './musgrave.types.js';

const CONFIG = MUSGRAVE_CONFIG;

// ============ Utility Functions ============

/**
 * Promise-based delay.
 */
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Random number between min and max (inclusive).
 */
const randomBetween = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const log = createLogger('MusgraveApi');

// ============ Token Functions ============

/**
 * Decode URL-encoded API token cookie.
 *
 * The apiToken cookie value is URL-encoded JSON containing the actual token.
 * Structure: { apiToken: "actual-token-here", ... }
 *
 * @param urlEncodedToken - The raw cookie value (URL-encoded)
 * @returns The decoded API token string
 * @throws Error if decoding fails
 */
export function decodeApiToken(urlEncodedToken: string): string {
  try {
    // Step 1: URL decode the token
    const decodedToken = decodeURIComponent(urlEncodedToken);

    // Step 2: Parse the JSON content
    const parsedToken = JSON.parse(decodedToken) as { apiToken: string };

    // Step 3: Extract and return the apiToken field
    if (!parsedToken.apiToken) {
      throw new Error('apiToken field not found in decoded token');
    }

    return parsedToken.apiToken;
  } catch (error) {
    const err = error as Error;
    log.error({ err }, 'Error decoding token');
    throw new Error(`Failed to decode API token: ${err.message}`);
  }
}

// ============ URL Building ============

/**
 * Build the full API URL for fetching products.
 *
 * URL Structure:
 * https://www-api.musgravemarketplace.ie/INTERSHOP/rest/WFS/musgrave-MWPIRL-Site/-;loc=en_IE;cur=EUR
 * /categories;spgid={pgId}/FoodServiceWebHierarchy/products
 * ?attrs=...&attributeGroup=...&amount=72&offset=0&productFilter=...&FreightClassID=CORE
 *
 * @param pgId - User's personalization group ID
 * @param offset - Pagination offset (0, 72, 144, ...)
 * @returns Full API URL
 */
export function buildApiUrl(pgId: string, offset: number): string {
  const { apiBaseUrl, api } = CONFIG;

  // Replace {pgId} placeholder in endpoint
  const endpoint = api.productsEndpoint.replace('{pgId}', pgId);
  const baseUrl = `${apiBaseUrl}${endpoint}`;

  // Build query parameters.
  // `FreightClassID` is only sent when configured (non-empty); some accounts
  // reject the request when it's present.
  const params = new URLSearchParams({
    attrs: api.attrs,
    attributeGroup: api.attributeGroup,
    amount: api.pageSize.toString(),
    offset: offset.toString(),
    productFilter: api.productFilter,
  });
  if (api.freightClassId) params.set('FreightClassID', api.freightClassId);

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generate an array of offsets for a batch of parallel requests.
 *
 * @param startOffset - Starting offset
 * @param count - Number of offsets to generate
 * @returns Array of offsets [startOffset, startOffset+72, startOffset+144, ...]
 */
export function generateOffsets(startOffset: number, count: number): number[] {
  const { pageSize } = CONFIG.api;
  return Array.from({ length: count }, (_, i) => startOffset + i * pageSize);
}

// ============ HTTP Login (bypasses Radware) ============

/**
 * Authenticate via OAuth2 password grant — no browser needed.
 *
 * POST /token → access_token
 * GET /personalization → pgId
 *
 * Returns the same MusgraveAuthTokens the scraper expects.
 */
export async function httpLogin(username: string, password: string): Promise<MusgraveAuthTokens> {
  // Step 1: POST /token with OAuth2 password grant
  const tokenBody = new URLSearchParams({
    grant_type: 'password',
    scope: 'openid profile',
    client_id: 'ICMClient',
    username,
    password,
  });

  log.debug('Requesting OAuth2 token via HTTP');

  const tokenRes = await fetch(CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
      origin: CONFIG.baseUrl,
      referer: `${CONFIG.baseUrl}/`,
    },
    body: tokenBody.toString(),
    signal: AbortSignal.timeout(CONFIG.api.requestTimeout),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text().catch(() => '');
    throw new Error(
      `Token request failed: HTTP ${tokenRes.status} ${tokenRes.statusText} — ${text}`
    );
  }

  const tokenData = (await tokenRes.json()) as MusgraveTokenResponse;

  if (!tokenData.access_token) {
    throw new Error('Token response missing access_token');
  }

  log.debug({ expiresIn: tokenData.expires_in }, 'OAuth2 token obtained');

  // Step 2: GET /personalization with the access token
  const persRes = await fetch(CONFIG.personalizationUrl, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'authentication-token': tokenData.access_token,
      origin: CONFIG.baseUrl,
      referer: `${CONFIG.baseUrl}/`,
    },
    signal: AbortSignal.timeout(CONFIG.api.requestTimeout),
  });

  if (!persRes.ok) {
    const text = await persRes.text().catch(() => '');
    throw new Error(
      `Personalization request failed: HTTP ${persRes.status} ${persRes.statusText} — ${text}`
    );
  }

  const persData = (await persRes.json()) as MusgravePersonalizationResponse;

  if (!persData.pgid) {
    throw new Error('Personalization response missing pgid');
  }

  log.info({ pgid: persData.pgid }, 'HTTP login successful');

  return {
    apiToken: tokenData.access_token,
    pgId: persData.pgid,
  };
}

// ============ Single Page Fetch ============

/**
 * Fetch a single page of products from the API.
 *
 * @param apiToken - Decoded API token
 * @param pgId - Personalization group ID
 * @param offset - Page offset
 * @returns Fetch result with success status, data, and any errors
 */
export async function fetchSinglePage(
  apiToken: string,
  pgId: string,
  offset: number
): Promise<MusgravePageFetchResult> {
  const url = buildApiUrl(pgId, offset);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'authentication-token': apiToken,
      },
      signal: AbortSignal.timeout(CONFIG.api.requestTimeout),
    });

    if (!response.ok) {
      return {
        success: false,
        data: [],
        offset,
        error: {
          status: response.status,
          message: response.statusText || `HTTP ${response.status}`,
        },
      };
    }

    const data = (await response.json()) as MusgraveApiResponse;

    return {
      success: true,
      data: data.elements || [],
      offset,
    };
  } catch (error) {
    const err = error as Error;
    return {
      success: false,
      data: [],
      offset,
      error: {
        status: 0,
        message: err.name === 'TimeoutError' ? 'Request timeout' : err.message,
      },
    };
  }
}

// ============ Parallel Page Fetch ============

/**
 * Fetch multiple pages in parallel with staggered starts.
 *
 * Staggering prevents all requests from hitting the server simultaneously,
 * which helps avoid rate limiting and detection.
 *
 * @param apiToken - Decoded API token
 * @param pgId - Personalization group ID
 * @param offsets - Array of offsets to fetch
 * @returns Array of fetch results
 */
export async function fetchParallelPages(
  apiToken: string,
  pgId: string,
  offsets: number[]
): Promise<MusgravePageFetchResult[]> {
  const { parallel } = CONFIG;

  const promises = offsets.map(async (offset, index) => {
    // Stagger the start of each request
    const staggerDelay = index * parallel.staggerDelay;
    const randomDelay = randomBetween(parallel.randomDelayMin, parallel.randomDelayMax);

    await delay(staggerDelay + randomDelay);

    return fetchSinglePage(apiToken, pgId, offset);
  });

  return Promise.all(promises);
}

// ============ API Service Class ============

/**
 * Musgrave API Service
 *
 * Encapsulates all API operations including:
 * - Token management
 * - Parallel fetching with rate limit handling
 * - Re-authentication on token expiry
 * - Concurrency management
 */
export class MusgraveApiService {
  private tokens: MusgraveAuthTokens | null = null;
  private concurrency: number = CONFIG.parallel.concurrency;

  /**
   * Set authentication tokens.
   */
  setTokens(tokens: MusgraveAuthTokens): void {
    this.tokens = tokens;
  }

  /**
   * Get current tokens.
   */
  getTokens(): MusgraveAuthTokens | null {
    return this.tokens;
  }

  /**
   * Clear tokens.
   */
  clearTokens(): void {
    this.tokens = null;
  }

  /**
   * Get current concurrency level.
   */
  getConcurrency(): number {
    return this.concurrency;
  }

  /**
   * Reset concurrency to default.
   */
  resetConcurrency(): void {
    this.concurrency = CONFIG.parallel.concurrency;
  }

  /**
   * Reduce concurrency (used after rate limiting).
   */
  private reduceConcurrency(): void {
    this.concurrency = Math.max(CONFIG.parallel.minConcurrency, this.concurrency - 1);
    log.warn({ concurrency: this.concurrency }, 'Reduced concurrency');
  }

  /**
   * Increase concurrency (used after recovery from rate limiting).
   */
  private increaseConcurrency(): void {
    if (this.concurrency < CONFIG.parallel.concurrency) {
      this.concurrency++;
      log.info({ concurrency: this.concurrency }, 'Increased concurrency');
    }
  }

  /**
   * Fetch all products using parallel fetching strategy.
   *
   * Key features:
   * - Parallel requests with staggered starts
   * - Rate limit handling (429) with backoff
   * - Re-authentication on token expiry (401)
   * - Progressive batch delivery via callback
   *
   * @param onReauthenticate - Callback to re-authenticate when token expires
   * @param onBatchReady - Callback called with each batch of products (for progressive processing)
   * @returns Fetch statistics
   */
  async fetchAllProducts(
    onReauthenticate: MusgraveReauthCallback,
    onBatchReady?: MusgraveBatchCallback
  ): Promise<MusgraveFetchStats> {
    if (!this.tokens) {
      throw new Error('No authentication tokens set. Call setTokens() first.');
    }

    const { parallel, api } = CONFIG;
    const stats: MusgraveFetchStats = {
      totalFetched: 0,
      totalBatches: 0,
      failedBatches: 0,
      rateLimitHits: 0,
      reauthCount: 0,
    };

    let currentOffset = 0;
    let consecutiveEmptyBatches = 0;
    let retryCount = 0;
    let wasRateLimited = false;

    log.info({ concurrency: this.concurrency }, 'Starting parallel fetch');

    while (consecutiveEmptyBatches < parallel.emptyBatchThreshold) {
      // Generate offsets for this batch
      const offsets = generateOffsets(currentOffset, this.concurrency);
      log.debug({ offsets, concurrency: this.concurrency }, 'Fetching offsets');

      try {
        // Fetch pages in parallel
        const results = await fetchParallelPages(this.tokens.apiToken, this.tokens.pgId, offsets);

        // Separate successes and errors
        const errors = results.filter((r) => !r.success);
        const successes = results.filter((r) => r.success);

        stats.totalBatches++;

        // Handle rate limiting (HTTP 429)
        const rateLimitError = errors.find((e) => e.error?.status === 429);
        if (rateLimitError) {
          log.warn({ backoffMs: parallel.rateLimitBackoff }, 'Rate limited');
          stats.rateLimitHits++;
          wasRateLimited = true;
          this.reduceConcurrency();
          await delay(parallel.rateLimitBackoff);
          continue; // Retry this batch
        }

        // Handle auth errors (HTTP 401)
        const authError = errors.find((e) => e.error?.status === 401);
        if (authError) {
          log.warn('Token expired, re-authenticating');
          const newTokens = await onReauthenticate();

          if (!newTokens) {
            log.error('Re-authentication failed');
            stats.failedBatches++;
            break;
          }

          this.tokens = newTokens;
          stats.reauthCount++;
          log.info('Re-authentication successful');
          continue; // Retry this batch with new tokens
        }

        // Log other errors
        if (errors.length > 0) {
          for (const error of errors) {
            log.warn({ offset: error.offset, error: error.error?.message }, 'Offset fetch failed');
          }
          stats.failedBatches++;
        }

        // Collect products from successful requests
        const batchProducts = successes.flatMap((r) => r.data);

        if (batchProducts.length === 0) {
          consecutiveEmptyBatches++;
          log.debug(
            { consecutiveEmptyBatches, emptyBatchThreshold: parallel.emptyBatchThreshold },
            'Empty batch received'
          );
        } else {
          consecutiveEmptyBatches = 0;
          stats.totalFetched += batchProducts.length;

          // Call the batch callback if provided (for progressive processing)
          if (onBatchReady) {
            await onBatchReady(batchProducts);
          }

          log.debug({ totalFetched: stats.totalFetched }, 'Batch fetch progress');
        }

        // Move to next batch of offsets
        currentOffset += this.concurrency * api.pageSize;
        retryCount = 0;

        // Delay before next batch (with jitter)
        const batchDelay = parallel.batchDelay + randomBetween(0, parallel.batchDelayJitter);
        await delay(batchDelay);

        // Gradually recover concurrency after rate limiting
        if (wasRateLimited) {
          this.increaseConcurrency();
          wasRateLimited = false;
        }
      } catch (error) {
        const err = error as Error;
        log.error({ err }, 'Batch error');
        stats.failedBatches++;

        retryCount++;
        if (retryCount >= parallel.maxRetryCount) {
          log.error({ retryCount }, 'Max retries exceeded');
          break;
        }

        await delay(parallel.retryDelay * retryCount);
      }
    }

    log.info(
      {
        totalFetched: stats.totalFetched,
        totalBatches: stats.totalBatches,
        failedBatches: stats.failedBatches,
      },
      'Fetch complete'
    );
    return stats;
  }
}

// ============ Singleton Export ============

export const musgraveApiService = new MusgraveApiService();
