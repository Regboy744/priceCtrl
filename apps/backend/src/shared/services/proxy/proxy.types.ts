/**
 * Proxy module types.
 *
 * All proxy-related types live here so the rest of the codebase
 * stays vendor-agnostic. Supplier scrapers never import
 * Decodo-specific details — they only see ProxyCredentials.
 */

// ============ Configuration Types ============

/** Which Decodo pool a supplier should route through. */
export type ProxyPool = 'residential' | 'isp';

/** Authentication mode for the proxy. */
export type ProxyMode = 'ip_whitelist' | 'userpass';

/** How proxy sessions behave between requests. */
export type ProxySessionStrategy = 'rotate' | 'sticky';

/** Scope at which a sticky session ID is generated. */
export type ProxySessionIdStrategy = 'per_job' | 'per_supplier' | 'per_browser';

/**
 * Residential pool config (Decodo rotating IPs, metered, session-aware).
 * Supports sticky sessions via enriched username parameters.
 */
export interface ResidentialProxyConfig {
  readonly enabled: boolean;
  readonly mode: ProxyMode;
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly password: string;
  readonly protocol: 'http' | 'https';
  readonly country: string | undefined;
  readonly sessionStrategy: ProxySessionStrategy;
  readonly sessionDurationMin: number;
  readonly sessionIdStrategy: ProxySessionIdStrategy;
  readonly timeoutMs: number;
}

/**
 * ISP/Static pool config (Decodo fixed IPs, unlimited bandwidth).
 * Plain userpass — no session encoding; IP is already stable.
 */
export interface IspProxyConfig {
  readonly enabled: boolean;
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly password: string;
  readonly protocol: 'http' | 'https';
  readonly timeoutMs: number;
}

// ============ Per-Supplier Policy ============

/**
 * Per-supplier proxy behaviour override.
 * Stored in a central map so scrapers stay proxy-agnostic.
 *
 * `pool` selects which Decodo product to use. Session fields only apply
 * when `pool === 'residential'` — ISP IPs are already static.
 */
export interface ProxyPolicy {
  readonly pool: ProxyPool;
  readonly sessionStrategy?: ProxySessionStrategy;
  readonly sessionDurationMin?: number;
  readonly sessionIdStrategy?: ProxySessionIdStrategy;
  readonly country?: string;
}

// ============ Runtime Options ============

/**
 * Options passed by callers (scrapers, health checks) when
 * requesting proxy credentials.  All fields optional —
 * defaults come from ProxyConfig + ProxyPolicy.
 */
export interface ProxyOptions {
  /** Explicit pool override; otherwise derived from supplier policy / default residential. */
  pool?: ProxyPool;
  country?: string;
  sessionId?: string;
  sessionDurationMin?: number;
  sticky?: boolean;
  /** Override the session-id scope (default: residential config value). */
  sessionIdStrategy?: ProxySessionIdStrategy;
  supplierKey?: string;
  jobId?: string;
}

// ============ Proxy Credentials (builder output) ============

/**
 * Resolved proxy credentials ready for Puppeteer or HTTP clients.
 * `serverArg` is safe to log; `password` must NEVER be logged.
 */
export interface ProxyCredentials {
  /** Which pool issued these credentials. */
  pool: ProxyPool;
  /** `host:port` for Chromium `--proxy-server` launch arg. */
  serverArg: string;
  /** Full proxy URL (may contain auth) for HTTP agents + curl `-x`. */
  url: string;
  /** Username with encoded session params — for `page.authenticate()`. */
  username?: string;
  /** Raw password — for `page.authenticate()`.  Never log this. */
  password?: string;
  /** Whether `page.authenticate()` is needed (true in userpass mode). */
  requiresAuth: boolean;
}

// ============ Test / Health ============

/**
 * Result of hitting the proxy test endpoint (ip.decodo.com/json).
 */
export interface ProxyTestResult {
  ok: boolean;
  ip?: string;
  country?: string;
  city?: string;
  asn?: string;
  error?: string;
  latencyMs: number;
}

// ============ Retry ============

/**
 * Options for the proxy-aware retry wrapper.
 */
export interface ProxyRetryOptions {
  /** Maximum attempts before giving up (default 3). */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff (default 1000). */
  baseDelayMs?: number;
  /** Maximum delay cap in ms (default 10_000). */
  maxDelayMs?: number;
  /** Correlation IDs for logging. */
  supplierKey?: string;
  jobId?: string;
  /** Rotate session ID after repeated failures when using sticky sessions. */
  rotateSessionOnFailure?: boolean;
}
