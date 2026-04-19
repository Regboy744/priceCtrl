/**
 * Proxy configuration — env parsing, validation, and supplier policy map.
 *
 * Reads DECODO_PROXY_* environment variables, validates them at import time
 * (fail-fast), and exposes an immutable ProxyConfig object plus a
 * per-supplier ProxyPolicy map.
 */

import { env } from '../../config/env.js';
import { createLogger } from '../logger.service.js';
import type {
  ProxyConfig,
  ProxyMode,
  ProxyPolicy,
  ProxySessionIdStrategy,
  ProxySessionStrategy,
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

// ============ Build Config from env ============

function buildProxyConfig(): ProxyConfig {
  const p = env.proxy;

  // When disabled, return safe defaults — no validation needed.
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

  // Fail fast: userpass mode requires credentials.
  if (mode === 'userpass') {
    if (!p.username || !p.password) {
      throw new Error(
        '[ProxyConfig] DECODO_PROXY_USERNAME and DECODO_PROXY_PASSWORD are required when mode is "userpass".'
      );
    }
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

  const config: ProxyConfig = {
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

  // Log startup info (never log secrets).
  log.info(
    {
      mode: config.mode,
      host: config.host,
      port: config.port,
      sessionStrategy: config.sessionStrategy,
      sessionIdStrategy: config.sessionIdStrategy,
      sessionDurationMin: config.sessionDurationMin,
      country: config.country ?? 'any',
      user: config.mode === 'userpass' ? maskString(config.username) : undefined,
    },
    'Proxy ENABLED'
  );

  return Object.freeze(config);
}

// ============ Supplier Proxy Policies ============

/**
 * Per-supplier proxy policy overrides.
 *
 * Suppliers not in this map fall back to the global ProxyConfig defaults.
 * Add/edit entries here when a supplier needs different behaviour.
 */
export const supplierProxyPolicies: Record<string, ProxyPolicy> = {
  'Musgrave Marketplace': {
    sessionStrategy: 'sticky',
    sessionDurationMin: 30,
    sessionIdStrategy: 'per_job',
  },
  "O'Reillys Wholesale": {
    sessionStrategy: 'sticky',
    sessionDurationMin: 30,
    sessionIdStrategy: 'per_job',
  },
  'Value Centre': {
    sessionStrategy: 'sticky',
    sessionDurationMin: 30,
    sessionIdStrategy: 'per_job',
  },
  'Savage & Whitten': {
    sessionStrategy: 'sticky',
    sessionDurationMin: 30,
    sessionIdStrategy: 'per_job',
  },
  'Barry Group': {
    sessionStrategy: 'sticky',
    sessionDurationMin: 30,
    sessionIdStrategy: 'per_job',
  },
};

// ============ Masking Utility ============

/**
 * Mask a string for safe logging.
 * Shows first 4 chars + last 2 chars, rest replaced with ***.
 */
export function maskString(value: string): string {
  if (value.length <= 6) return '***';
  return `${value.slice(0, 4)}***${value.slice(-2)}`;
}

/**
 * Return a log-safe representation of proxy credentials.
 * Never includes the raw password.
 */
export function safeCredentialsSummary(host: string, port: number, username?: string): string {
  const userPart = username ? `user=${maskString(username)}@` : '';
  return `${userPart}${host}:${port}`;
}

// ============ Singleton Export ============

/** Immutable proxy configuration. Validated at import time. */
export const proxyConfig: ProxyConfig = buildProxyConfig();
