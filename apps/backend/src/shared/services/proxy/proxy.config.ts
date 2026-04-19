/**
 * Proxy configuration — env parsing, validation, and supplier policy map.
 *
 * Two independent Decodo pools are supported side-by-side:
 *   - residential: rotating IPs, session-aware  (DECODO_PROXY_*)
 *   - isp:         fixed IPs, unlimited         (DECODO_ISP_PROXY_*)
 *
 * Each supplier picks its pool via `supplierProxyPolicies` below.
 */

import { env } from '../../config/env.js';
import { createLogger } from '../logger.service.js';
import type {
  IspProxyConfig,
  ProxyMode,
  ProxyPool,
  ProxyPolicy,
  ProxySessionIdStrategy,
  ProxySessionStrategy,
  ResidentialProxyConfig,
} from './proxy.types.js';

const log = createLogger('ProxyConfig');

// ============ Validation Helpers ============

function assertOneOf<T extends string>(value: string, allowed: readonly T[], label: string): T {
  if (!allowed.includes(value as T)) {
    throw new Error(
      `[ProxyConfig] Invalid ${label}: "${value}". Must be one of: ${allowed.join(', ')}`
    );
  }
  return value as T;
}

// ============ Residential Pool ============

function buildResidentialConfig(): ResidentialProxyConfig {
  const p = env.proxy.residential;

  if (!p.enabled) {
    return {
      enabled: false,
      mode: 'ip_whitelist',
      host: 'gate.decodo.com',
      port: 7000,
      username: '',
      password: '',
      protocol: 'http',
      country: undefined,
      sessionStrategy: 'rotate',
      sessionDurationMin: 30,
      sessionIdStrategy: 'per_job',
      timeoutMs: 30_000,
    };
  }

  const mode = assertOneOf<ProxyMode>(p.mode, ['ip_whitelist', 'userpass'], 'DECODO_PROXY_MODE');

  if (mode === 'userpass' && (!p.username || !p.password)) {
    throw new Error(
      '[ProxyConfig] DECODO_PROXY_USERNAME and DECODO_PROXY_PASSWORD are required when mode is "userpass".'
    );
  }

  const protocol = assertOneOf<'http' | 'https'>(
    p.protocol,
    ['http', 'https'],
    'DECODO_PROXY_PROTOCOL'
  );
  const sessionStrategy = assertOneOf<ProxySessionStrategy>(
    p.sessionStrategy,
    ['rotate', 'sticky'],
    'DECODO_PROXY_SESSION_STRATEGY'
  );
  const sessionIdStrategy = assertOneOf<ProxySessionIdStrategy>(
    p.sessionIdStrategy,
    ['per_job', 'per_supplier', 'per_browser'],
    'DECODO_PROXY_SESSION_ID_STRATEGY'
  );

  const config: ResidentialProxyConfig = {
    enabled: true,
    mode,
    host: p.host,
    port: p.port,
    username: p.username,
    password: p.password,
    protocol,
    country: p.country || undefined,
    sessionStrategy,
    sessionDurationMin: p.sessionDurationMin,
    sessionIdStrategy,
    timeoutMs: p.timeoutMs,
  };

  log.info(
    {
      pool: 'residential',
      mode: config.mode,
      host: config.host,
      port: config.port,
      sessionStrategy: config.sessionStrategy,
      sessionIdStrategy: config.sessionIdStrategy,
      sessionDurationMin: config.sessionDurationMin,
      country: config.country ?? 'any',
      user: config.mode === 'userpass' ? maskString(config.username) : undefined,
    },
    'Residential proxy ENABLED'
  );

  return Object.freeze(config);
}

// ============ ISP Pool ============

function buildIspConfig(): IspProxyConfig {
  const p = env.proxy.isp;

  if (!p.enabled) {
    return {
      enabled: false,
      host: 'isp.decodo.com',
      port: 10001,
      username: '',
      password: '',
      protocol: 'http',
      timeoutMs: 30_000,
    };
  }

  if (!p.username || !p.password) {
    throw new Error(
      '[ProxyConfig] DECODO_ISP_PROXY_USERNAME and DECODO_ISP_PROXY_PASSWORD are required when ISP pool is enabled.'
    );
  }

  const protocol = assertOneOf<'http' | 'https'>(
    p.protocol,
    ['http', 'https'],
    'DECODO_ISP_PROXY_PROTOCOL'
  );

  const config: IspProxyConfig = {
    enabled: true,
    host: p.host,
    port: p.port,
    username: p.username,
    password: p.password,
    protocol,
    timeoutMs: p.timeoutMs,
  };

  log.info(
    {
      pool: 'isp',
      host: config.host,
      port: config.port,
      user: maskString(config.username),
    },
    'ISP proxy ENABLED'
  );

  return Object.freeze(config);
}

// ============ Supplier Proxy Policies ============

/**
 * Per-supplier proxy policy. Every supplier MUST specify a pool.
 * Flip a supplier between pools by editing this map — no env change needed.
 *
 * Suppliers missing from this map fall back to residential w/ rotate.
 */
export const supplierProxyPolicies: Record<string, ProxyPolicy> = {
  'Musgrave Marketplace': { pool: 'isp' },
  "O'Reillys Wholesale": { pool: 'isp' },
  'Value Centre': { pool: 'isp' },
  'Savage & Whitten': { pool: 'isp' },
  'Barry Group': { pool: 'isp' },
};

/** Resolve a supplier's pool, falling back to residential. */
export function resolveSupplierPool(supplierKey?: string): ProxyPool {
  if (!supplierKey) return 'residential';
  return supplierProxyPolicies[supplierKey]?.pool ?? 'residential';
}

// ============ Masking Utility ============

export function maskString(value: string): string {
  if (value.length <= 6) return '***';
  return `${value.slice(0, 4)}***${value.slice(-2)}`;
}

export function safeCredentialsSummary(host: string, port: number, username?: string): string {
  const userPart = username ? `user=${maskString(username)}@` : '';
  return `${userPart}${host}:${port}`;
}

// ============ Singleton Exports ============

export const residentialConfig: ResidentialProxyConfig = buildResidentialConfig();
export const ispConfig: IspProxyConfig = buildIspConfig();

/**
 * True when at least one pool is enabled. Callers that don't care which
 * pool (eg. curl.service falling through when neither is on) use this.
 */
export const anyProxyEnabled: boolean = residentialConfig.enabled || ispConfig.enabled;
