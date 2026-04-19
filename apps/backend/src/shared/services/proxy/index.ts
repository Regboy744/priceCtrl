/**
 * Proxy module public API.
 *
 * Import from here — never import internal files directly.
 *
 * Usage examples:
 *   import { proxyService, proxyConfig } from '../../shared/services/proxy/index.js';
 */

// Types (re-exported for consumers)
export type {
  ProxyConfig,
  ProxyCredentials,
  ProxyMode,
  ProxyOptions,
  ProxyPolicy,
  ProxyRetryOptions,
  ProxySessionIdStrategy,
  ProxySessionStrategy,
  ProxyTestResult,
} from './proxy.types.js';

// Config singleton + utilities
export {
  maskString,
  proxyConfig,
  safeCredentialsSummary,
  supplierProxyPolicies,
} from './proxy.config.js';

// Service singleton
export { proxyService } from './proxy.service.js';
