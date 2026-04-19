/**
 * Proxy Service — credentials, session management, testing, retry.
 *
 * Two pools are available and selected per-call:
 *   - residential: session-encoded username (sticky/rotate) via DECODO_PROXY_*
 *   - isp:         plain userpass, fixed IPs                 via DECODO_ISP_PROXY_*
 *
 * Supplier scrapers never touch this directly — they go through BrowserService,
 * CurlService, or BaseScraper, which internally resolve the right pool based on
 * the supplier's policy in proxy.config.ts.
 */

import { randomUUID } from 'node:crypto';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { createLogger } from '../logger.service.js';
import {
  ispConfig,
  maskString,
  residentialConfig,
  resolveSupplierPool,
  safeCredentialsSummary,
  supplierProxyPolicies,
} from './proxy.config.js';
import type {
  ProxyCredentials,
  ProxyOptions,
  ProxyPolicy,
  ProxyPool,
  ProxyRetryOptions,
  ProxyTestResult,
} from './proxy.types.js';

const log = createLogger('ProxyService');

// ============ Session ID Management (residential only) ============

const sessionIdStore = new Map<string, string>();

function sessionCacheKey(
  strategy: 'per_job' | 'per_supplier' | 'per_browser',
  supplierKey?: string,
  jobId?: string
): string {
  switch (strategy) {
    case 'per_job':
      if (!jobId) {
        // Without a jobId the callsite can't bind to a job — fall back to a
        // stable key (ideally scoped to the supplier) so sessionIdStore
        // doesn't grow unboundedly with random UUIDs that are never read again.
        log.warn(
          { supplierKey },
          'per_job session requested without jobId — using stable fallback key'
        );
        return `job:default:${supplierKey ?? 'unknown'}`;
      }
      return `job:${jobId}`;
    case 'per_supplier':
      return `supplier:${supplierKey ?? 'default'}`;
    case 'per_browser':
      return `browser:${randomUUID()}`;
  }
}

function getOrCreateSessionId(cacheKey: string): string {
  let id = sessionIdStore.get(cacheKey);
  if (!id) {
    id = randomUUID().replace(/-/g, '').slice(0, 16);
    sessionIdStore.set(cacheKey, id);
  }
  return id;
}

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

// ============ Credentials builders (per pool) ============

function buildResidentialCredentials(options?: ProxyOptions): ProxyCredentials {
  const cfg = residentialConfig;
  const serverArg = `${cfg.host}:${cfg.port}`;

  if (cfg.mode === 'ip_whitelist') {
    return {
      pool: 'residential',
      serverArg,
      url: `${cfg.protocol}://${cfg.host}:${cfg.port}`,
      requiresAuth: false,
    };
  }

  const sticky = options?.sticky ?? cfg.sessionStrategy === 'sticky';
  const durationMin = options?.sessionDurationMin ?? cfg.sessionDurationMin;
  const country = options?.country ?? cfg.country;

  let enrichedUser = cfg.username;

  if (sticky && durationMin > 0) {
    enrichedUser += `-sessionduration-${durationMin}`;
  }
  if (sticky) {
    const idStrategy = options?.sessionIdStrategy ?? cfg.sessionIdStrategy;
    const sessionId =
      options?.sessionId ??
      getOrCreateSessionId(
        sessionCacheKey(idStrategy, options?.supplierKey, options?.jobId)
      );
    enrichedUser += `-session-${sessionId}`;
  }
  if (country) {
    enrichedUser += `-country-${country}`;
  }

  const encodedPassword = encodeURIComponent(cfg.password);
  const encodedUser = encodeURIComponent(enrichedUser);
  const url = `${cfg.protocol}://${encodedUser}:${encodedPassword}@${cfg.host}:${cfg.port}`;

  return {
    pool: 'residential',
    serverArg,
    url,
    username: enrichedUser,
    password: cfg.password,
    requiresAuth: true,
  };
}

function buildIspCredentials(): ProxyCredentials {
  const cfg = ispConfig;
  const serverArg = `${cfg.host}:${cfg.port}`;
  const encodedPassword = encodeURIComponent(cfg.password);
  const encodedUser = encodeURIComponent(cfg.username);
  const url = `${cfg.protocol}://${encodedUser}:${encodedPassword}@${cfg.host}:${cfg.port}`;

  return {
    pool: 'isp',
    serverArg,
    url,
    username: cfg.username,
    password: cfg.password,
    requiresAuth: true,
  };
}

// ============ Proxy Service ============

class ProxyService {
  /**
   * Build credentials for the requested pool.
   * Pool resolution order: explicit options.pool > supplier policy > 'residential'.
   */
  buildCredentials(options?: ProxyOptions): ProxyCredentials {
    const pool: ProxyPool =
      options?.pool ?? resolveSupplierPool(options?.supplierKey);

    if (pool === 'isp') {
      if (!ispConfig.enabled) {
        throw new Error('[ProxyService] ISP pool requested but disabled.');
      }
      return buildIspCredentials();
    }

    if (!residentialConfig.enabled) {
      throw new Error('[ProxyService] Residential pool requested but disabled.');
    }
    return buildResidentialCredentials(options);
  }

  /**
   * Resolve credentials for a supplier using the central policy map.
   * Returns null when the resolved pool is disabled — so callers can gracefully
   * fall through to direct (unproxied) requests instead of throwing.
   */
  buildCredentialsForSupplier(supplierKey: string, jobId?: string): ProxyCredentials | null {
    const policy: ProxyPolicy | undefined = supplierProxyPolicies[supplierKey];
    const pool: ProxyPool = policy?.pool ?? 'residential';

    if (pool === 'isp' && !ispConfig.enabled) return null;
    if (pool === 'residential' && !residentialConfig.enabled) return null;

    return this.buildCredentials({
      pool,
      sticky: policy?.sessionStrategy === 'sticky',
      sessionDurationMin: policy?.sessionDurationMin,
      sessionIdStrategy: policy?.sessionIdStrategy,
      country: policy?.country,
      supplierKey,
      jobId,
    });
  }

  /**
   * Test proxy connectivity by hitting https://ip.decodo.com/json.
   */
  async testConnection(options?: ProxyOptions): Promise<ProxyTestResult> {
    const pool: ProxyPool =
      options?.pool ?? resolveSupplierPool(options?.supplierKey);
    const startMs = Date.now();

    const poolEnabled = pool === 'isp' ? ispConfig.enabled : residentialConfig.enabled;
    if (!poolEnabled) {
      return { ok: false, error: `Pool "${pool}" is disabled`, latencyMs: 0 };
    }

    const timeoutMs = pool === 'isp' ? ispConfig.timeoutMs : residentialConfig.timeoutMs;

    try {
      const creds = this.buildCredentials(options);
      const agent = getOrCreateAgent(creds.url);

      const response = await fetch('https://ip.decodo.com/json', {
        // @ts-expect-error -- Node fetch supports agent via dispatcher, https-proxy-agent works here
        agent,
        signal: AbortSignal.timeout(timeoutMs),
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
        { pool, ip: result.ip, country: result.country, latencyMs: result.latencyMs },
        'Proxy test OK'
      );
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const latency = Date.now() - startMs;
      log.error({ pool, err: error, latencyMs: latency }, 'Proxy test FAILED');
      return { ok: false, error: error.message, latencyMs: latency };
    }
  }

  /**
   * Retry wrapper with exponential backoff. Session rotation only applies
   * to residential sticky sessions; ignored on ISP pool.
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
        lastError = err instanceof Error ? err : new Error(String(err));
        const isRetryable = this.isRetryableError(lastError);

        log.warn(
          { scope: logPrefix, attempt, maxRetries, retryable: isRetryable, err: lastError },
          'Retry attempt failed'
        );

        if (!isRetryable || attempt === maxRetries) {
          break;
        }

        const pool: ProxyPool = resolveSupplierPool(options?.supplierKey);
        if (
          options?.rotateSessionOnFailure &&
          pool === 'residential' &&
          attempt >= Math.ceil(maxRetries / 2) &&
          options.supplierKey
        ) {
          const key = sessionCacheKey(
            residentialConfig.sessionIdStrategy,
            options.supplierKey,
            options.jobId
          );
          const newId = rotateSessionId(key);
          log.debug({ scope: logPrefix, newSessionId: newId }, 'Rotated session ID');
        }

        const delay = Math.min(baseDelay * 2 ** (attempt - 1), maxDelay);
        const jitter = Math.floor(Math.random() * delay * 0.3);
        await new Promise((resolve) => setTimeout(resolve, delay + jitter));
      }
    }

    throw lastError ?? new Error('Retry failed with no error captured');
  }

  /** Get an HttpsProxyAgent for Node-level HTTP requests (cached). */
  getHttpAgent(options?: ProxyOptions): HttpsProxyAgent<string> {
    const creds = this.buildCredentials(options);
    return getOrCreateAgent(creds.url);
  }

  /** True when either pool is enabled. */
  get isEnabled(): boolean {
    return residentialConfig.enabled || ispConfig.enabled;
  }

  clearSessions(): void {
    sessionIdStore.clear();
  }

  clearAgentCache(): void {
    agentCache.clear();
  }

  /** Log-safe summary of both pools (no secrets). */
  getConfigSummary(): Record<string, unknown> {
    return {
      residential: residentialConfig.enabled
        ? {
            enabled: true,
            mode: residentialConfig.mode,
            endpoint: safeCredentialsSummary(
              residentialConfig.host,
              residentialConfig.port,
              residentialConfig.mode === 'userpass' ? residentialConfig.username : undefined
            ),
            sessionStrategy: residentialConfig.sessionStrategy,
            sessionIdStrategy: residentialConfig.sessionIdStrategy,
            sessionDurationMin: residentialConfig.sessionDurationMin,
            country: residentialConfig.country ?? 'any',
          }
        : { enabled: false },
      isp: ispConfig.enabled
        ? {
            enabled: true,
            endpoint: safeCredentialsSummary(ispConfig.host, ispConfig.port, ispConfig.username),
          }
        : { enabled: false },
    };
  }

  private isRetryableError(error: Error): boolean {
    const msg = error.message.toLowerCase();
    if (msg.includes('407')) return true;
    if (msg.includes('econnreset')) return true;
    if (msg.includes('econnrefused')) return true;
    if (msg.includes('etimedout')) return true;
    if (msg.includes('timeout')) return true;
    if (msg.includes('socket hang up')) return true;
    if (msg.includes('network')) return true;
    return false;
  }
}

export const proxyService = new ProxyService();
