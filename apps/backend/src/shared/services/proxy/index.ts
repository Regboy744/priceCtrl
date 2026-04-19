/**
 * Proxy module public API.
 *
 * Import from here — never import internal files directly.
 *
 * Usage examples:
 *   import { proxyService, residentialConfig, ispConfig } from '../../shared/services/proxy/index.js';
 */

// Types (re-exported for consumers)
export type {
  IspProxyConfig,
  ProxyCredentials,
  ProxyMode,
  ProxyOptions,
  ProxyPolicy,
  ProxyPool,
  ProxyRetryOptions,
  ProxySessionIdStrategy,
  ProxySessionStrategy,
  ProxyTestResult,
  ResidentialProxyConfig,
} from './proxy.types.js';

// Config singletons + utilities
export {
  anyProxyEnabled,
  ispConfig,
  maskString,
  residentialConfig,
  resolveSupplierPool,
  safeCredentialsSummary,
  supplierProxyPolicies,
} from './proxy.config.js';

// Service singleton
export { proxyService } from './proxy.service.js';
