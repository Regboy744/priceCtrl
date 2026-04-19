/**
 * Proxy Service — the single source of truth for proxy credentials,
 * session management, testing, and retry logic.
 *
 * Callers (BrowserService, health checks, smoke tests) ask this service
 * for ProxyCredentials.  Supplier scrapers never touch this directly;
 * they go through BrowserService / BaseScraper which call here internally.
 */

import { randomUUID } from 'node:crypto';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { createLogger } from '../logger.service.js';
import {
  maskString,
  proxyConfig,
  safeCredentialsSummary,
  supplierProxyPolicies,
} from './proxy.config.js';
import type {
  ProxyCredentials,
  ProxyOptions,
  ProxyPolicy,
  ProxyRetryOptions,
  ProxyTestResult,
} from './proxy.types.js';

const log = createLogger('ProxyService');

// ============ Session ID Management ============

/**
 * Internal store of session IDs keyed by scope identifier.
 * Allows sticky sessions to persist across calls within the same scope.
 */
const sessionIdStore = new Map<string, string>();

/**
 * Derive a cache key for the session ID based on strategy + context.
 */
function sessionCacheKey(
  strategy: 'per_job' | 'per_supplier' | 'per_browser',
  supplierKey?: string,
  jobId?: string
): string {
  switch (strategy) {
    case 'per_job':
      return `job:${jobId ?? randomUUID()}`;
    case 'per_supplier':
      return `supplier:${supplierKey ?? 'default'}`;
    case 'per_browser':
      return `browser:${randomUUID()}`;
  }
}

/**
 * Get or create a session ID for the given scope.
 */
function getOrCreateSessionId(cacheKey: string): string {
  let id = sessionIdStore.get(cacheKey);
  if (!id) {
    id = randomUUID().replace(/-/g, '').slice(0, 16);
    sessionIdStore.set(cacheKey, id);
  }
  return id;
}

/**
 * Force-rotate a session ID for the given scope (used on repeated failures).
 */
function rotateSessionId(cacheKey: string): string {
  const newId = randomUUID().replace(/-/g, '').slice(0, 16);
  sessionIdStore.set(cacheKey, newId);
  return newId;
}

// ============ HTTP Agent Cache ============

const agentCache = new Map<string, HttpsProxyAgent<string>>();

function getOrCreateAgent(proxyUrl: string): HttpsProxyAgent<string> {
  let agent = agentCache.get(proxyUrl);
  if (!agent) {
    agent = new HttpsProxyAgent(proxyUrl);
    agentCache.set(proxyUrl, agent);
  }
  return agent;
}

// ============ Proxy Service ============

class ProxyService {
  /**
   * Build proxy credentials from options + global config.
   *
   * In `userpass` mode the Decodo-style username encodes session
   * parameters:
   *   user-<BASE_USER>-sessionduration-<MIN>-session-<ID>-country-<CC>
   *
   * In `ip_whitelist` mode no credentials are needed — the proxy
   * authenticates by the caller's IP.
   */
  buildCredentials(options?: ProxyOptions): ProxyCredentials {
    const cfg = proxyConfig;

    if (!cfg.enabled) {
      throw new Error('[ProxyService] Cannot build credentials — proxy is disabled.');
    }

    const serverArg = `${cfg.host}:${cfg.port}`;

    if (cfg.mode === 'ip_whitelist') {
      return {
        serverArg,
        url: `${cfg.protocol}://${cfg.host}:${cfg.port}`,
        requiresAuth: false,
      };
    }

    // ---- userpass mode: build enriched username ----
    const sticky = options?.sticky ?? cfg.sessionStrategy === 'sticky';
    const durationMin = options?.sessionDurationMin ?? cfg.sessionDurationMin;
    const country = options?.country ?? cfg.country;

    // Build the enriched username with Decodo param encoding.
    // Base format: user-<BASE_USER>
    // Append optional params: -sessionduration-N -session-ID -country-CC
    let enrichedUser = cfg.username;

    if (sticky && durationMin > 0) {
      enrichedUser += `-sessionduration-${durationMin}`;
    }

    if (sticky) {
      const sessionId =
        options?.sessionId ??
        getOrCreateSessionId(
          sessionCacheKey(cfg.sessionIdStrategy, options?.supplierKey, options?.jobId)
        );
      enrichedUser += `-session-${sessionId}`;
    }

    if (country) {
      enrichedUser += `-country-${country}`;
    }

    // Encode password for URL (handles special chars like = / @).
    const encodedPassword = encodeURIComponent(cfg.password);
    const encodedUser = encodeURIComponent(enrichedUser);

    const url = `${cfg.protocol}://${encodedUser}:${encodedPassword}@${cfg.host}:${cfg.port}`;

    return {
      serverArg,
      url,
      username: enrichedUser,
      password: cfg.password,
      requiresAuth: true,
    };
  }

  /**
   * Build credentials using the supplier's policy from the central map.
   * Falls back to global defaults if the supplier has no explicit policy.
   */
  buildCredentialsForSupplier(supplierKey: string, jobId?: string): ProxyCredentials {
    const policy: ProxyPolicy | undefined = supplierProxyPolicies[supplierKey];

    return this.buildCredentials({
      sticky: policy?.sessionStrategy === 'sticky',
      sessionDurationMin: policy?.sessionDurationMin,
      country: policy?.country,
      supplierKey,
      jobId,
    });
  }

  /**
   * Test proxy connectivity by hitting https://ip.decodo.com/json.
   * Returns the detected IP, country, and latency.
   */
  async testConnection(options?: ProxyOptions): Promise<ProxyTestResult> {
    const cfg = proxyConfig;
    const startMs = Date.now();

    if (!cfg.enabled) {
      return { ok: false, error: 'Proxy is disabled', latencyMs: 0 };
    }

    try {
      const creds = options ? this.buildCredentials(options) : this.buildCredentials();
      const agent = getOrCreateAgent(creds.url);

      const response = await fetch('https://ip.decodo.com/json', {
        // @ts-expect-error -- Node fetch supports agent via dispatcher, https-proxy-agent works here
        agent,
        signal: AbortSignal.timeout(cfg.timeoutMs),
      });

      if (!response.ok) {
        return {
          ok: false,
          error: `HTTP ${response.status} ${response.statusText}`,
          latencyMs: Date.now() - startMs,
        };
      }

      const data = (await response.json()) as Record<string, unknown>;

      const result: ProxyTestResult = {
        ok: true,
        ip: (data.ip as string) ?? (data.query as string) ?? undefined,
        country: (data.country as string) ?? undefined,
        city: (data.city as string) ?? undefined,
        asn: (data.as as string) ?? (data.asn as string) ?? undefined,
        latencyMs: Date.now() - startMs,
      };

      log.debug(
        { ip: result.ip, country: result.country, city: result.city, latencyMs: result.latencyMs },
        'Proxy test OK'
      );

      return result;
    } catch (err) {
      const error = err as Error;
      const latency = Date.now() - startMs;
      log.error({ err: error, latencyMs: latency }, 'Proxy test FAILED');
      return { ok: false, error: error.message, latencyMs: latency };
    }
  }

  /**
   * Generic retry wrapper that handles proxy-specific failures.
   *
   * On 407 / ECONNRESET / ETIMEDOUT it retries with exponential backoff.
   * When `rotateSessionOnFailure` is true and using sticky sessions,
   * the session ID is rotated after half the retries have been exhausted.
   */
  async withRetry<T>(fn: () => Promise<T>, options?: ProxyRetryOptions): Promise<T> {
    const maxRetries = options?.maxRetries ?? 3;
    const baseDelay = options?.baseDelayMs ?? 1_000;
    const maxDelay = options?.maxDelayMs ?? 10_000;
    const logPrefix = [options?.supplierKey, options?.jobId].filter(Boolean).join('/') || 'proxy';

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err as Error;
        const isRetryable = this.isRetryableError(lastError);

        log.warn(
          { scope: logPrefix, attempt, maxRetries, retryable: isRetryable, err: lastError },
          'Retry attempt failed'
        );

        if (!isRetryable || attempt === maxRetries) {
          break;
        }

        // Rotate session mid-way through retries if configured.
        if (
          options?.rotateSessionOnFailure &&
          attempt >= Math.ceil(maxRetries / 2) &&
          options.supplierKey
        ) {
          const key = sessionCacheKey(
            proxyConfig.sessionIdStrategy,
            options.supplierKey,
            options.jobId
          );
          const newId = rotateSessionId(key);
          log.debug({ scope: logPrefix, newSessionId: newId }, 'Rotated session ID');
        }

        // Exponential backoff with jitter.
        const delay = Math.min(baseDelay * 2 ** (attempt - 1), maxDelay);
        const jitter = Math.floor(Math.random() * delay * 0.3);
        await new Promise((resolve) => setTimeout(resolve, delay + jitter));
      }
    }

    throw lastError ?? new Error('Retry failed with no error captured');
  }

  /**
   * Get an HttpsProxyAgent for Node-level HTTP requests (cached).
   */
  getHttpAgent(options?: ProxyOptions): HttpsProxyAgent<string> {
    if (!proxyConfig.enabled) {
      throw new Error('[ProxyService] Cannot create HTTP agent — proxy is disabled.');
    }
    const creds = options ? this.buildCredentials(options) : this.buildCredentials();
    return getOrCreateAgent(creds.url);
  }

  /**
   * Whether the proxy is currently enabled.
   */
  get isEnabled(): boolean {
    return proxyConfig.enabled;
  }

  /**
   * Clear all cached session IDs (useful for testing).
   */
  clearSessions(): void {
    sessionIdStore.clear();
  }

  /**
   * Clear agent cache (useful for testing / credential rotation).
   */
  clearAgentCache(): void {
    agentCache.clear();
  }

  /**
   * Log-safe summary of the current config (no secrets).
   */
  getConfigSummary(): Record<string, unknown> {
    const cfg = proxyConfig;
    return {
      enabled: cfg.enabled,
      mode: cfg.mode,
      endpoint: safeCredentialsSummary(
        cfg.host,
        cfg.port,
        cfg.mode === 'userpass' ? cfg.username : undefined
      ),
      sessionStrategy: cfg.sessionStrategy,
      sessionIdStrategy: cfg.sessionIdStrategy,
      sessionDurationMin: cfg.sessionDurationMin,
      country: cfg.country ?? 'any',
    };
  }

  // ============ Private Helpers ============

  /**
   * Determine whether an error is likely a transient proxy issue
   * that warrants a retry.
   */
  private isRetryableError(error: Error): boolean {
    const msg = error.message.toLowerCase();

    // HTTP 407 Proxy Authentication Required
    if (msg.includes('407')) return true;

    // Connection-level errors
    if (msg.includes('econnreset')) return true;
    if (msg.includes('econnrefused')) return true;
    if (msg.includes('etimedout')) return true;
    if (msg.includes('timeout')) return true;
    if (msg.includes('socket hang up')) return true;
    if (msg.includes('network')) return true;

    return false;
  }
}

// Singleton
export const proxyService = new ProxyService();
