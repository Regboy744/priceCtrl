/**
 * Environment configuration.
 *
 * Note: This module relies on Node.js native --env-file flag (Node 20.6+)
 * or the environment variables being set externally.
 * The dev/start scripts use: --env-file=.env
 */

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvVarAsNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing required environment variable: ${key}`);
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number`);
  }
  return parsed;
}

function getEnvVarAsBoolean(key: string, defaultValue?: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.toLowerCase() === 'true' || value === '1';
}

function getAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS;
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const env = {
  // Server
  port: getEnvVarAsNumber('PORT', 3000),
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  isDev: getEnvVar('NODE_ENV', 'development') === 'development',
  isProd: getEnvVar('NODE_ENV', 'development') === 'production',
  allowedOrigins: getAllowedOrigins(),

  // Supabase
  supabase: {
    url: getEnvVar('SUPABASE_URL'),
    anonKey: getEnvVar('SUPABASE_ANON_KEY'),
    serviceRoleKey: getEnvVar('SUPABASE_SERVICE_ROLE_KEY'),
  },

  // Scraping
  scraping: {
    cronSchedule: getEnvVar('SCRAPE_CRON_SCHEDULE', '0 6,12,18 * * *'),
    headless: getEnvVarAsBoolean('SCRAPE_HEADLESS', true),
    timeout: getEnvVarAsNumber('SCRAPE_TIMEOUT', 60000),
  },

  // Path to the curl-impersonate (chrome131) binary used by HTTP order
  // handlers and curl-only scrapers. Default matches the container install
  // path; Arch uses /usr/bin/curl_chrome131, macOS dev may use /opt/homebrew/...
  curlImpersonatePath: getEnvVar('CURL_IMPERSONATE_PATH', '/usr/local/bin/curl_chrome131'),

  // Logging
  logLevel: getEnvVar('LOG_LEVEL', 'info'),
  logFileEnabled: getEnvVarAsBoolean(
    'LOG_FILE_ENABLED',
    getEnvVar('NODE_ENV', 'development') === 'production'
  ),
  logFilePath: getEnvVar('LOG_FILE_PATH', './logs/app.log'),
  logFileMaxSize: getEnvVar('LOG_FILE_MAX_SIZE', '10m'),
  logFileMaxFiles: getEnvVarAsNumber('LOG_FILE_MAX_FILES', 5),

  // Price comparison behaviour
  priceCompare: {
    // When true, rank suppliers by `unit_cost_incl_vat` (normalized, accurate).
    // When false, fall back to legacy "most expensive case-price per supplier"
    // — emergency rollback without a redeploy.
    useUnitCost: getEnvVarAsBoolean('PRICE_COMPARE_USE_UNIT_COST', true),
  },

  // Proxy — two separate Decodo pools, selected per-supplier in proxy.config.ts.
  //  - residential: rotating IPs, metered bandwidth, session-aware (Decodo "Residential")
  //  - isp:         fixed IPs, unlimited bandwidth, plain userpass (Decodo "ISP/Static")
  proxy: {
    residential: {
      enabled: getEnvVarAsBoolean('DECODO_PROXY_ENABLED', false),
      mode: getEnvVar('DECODO_PROXY_MODE', 'ip_whitelist'),
      host: getEnvVar('DECODO_PROXY_HOST', 'gate.decodo.com'),
      port: getEnvVarAsNumber('DECODO_PROXY_PORT', 7000),
      username: getEnvVar('DECODO_PROXY_USERNAME', ''),
      password: getEnvVar('DECODO_PROXY_PASSWORD', ''),
      protocol: getEnvVar('DECODO_PROXY_PROTOCOL', 'http'),
      country: getEnvVar('DECODO_PROXY_COUNTRY', ''),
      sessionStrategy: getEnvVar('DECODO_PROXY_SESSION_STRATEGY', 'sticky'),
      sessionDurationMin: getEnvVarAsNumber('DECODO_PROXY_SESSION_DURATION_MIN', 30),
      sessionIdStrategy: getEnvVar('DECODO_PROXY_SESSION_ID_STRATEGY', 'per_job'),
      timeoutMs: getEnvVarAsNumber('DECODO_PROXY_TIMEOUT_MS', 30000),
    },
    isp: {
      enabled: getEnvVarAsBoolean('DECODO_ISP_PROXY_ENABLED', false),
      host: getEnvVar('DECODO_ISP_PROXY_HOST', 'isp.decodo.com'),
      port: getEnvVarAsNumber('DECODO_ISP_PROXY_PORT', 10001),
      username: getEnvVar('DECODO_ISP_PROXY_USERNAME', ''),
      password: getEnvVar('DECODO_ISP_PROXY_PASSWORD', ''),
      protocol: getEnvVar('DECODO_ISP_PROXY_PROTOCOL', 'http'),
      timeoutMs: getEnvVarAsNumber('DECODO_ISP_PROXY_TIMEOUT_MS', 30000),
    },
  },
} as const;

export type Env = typeof env;
