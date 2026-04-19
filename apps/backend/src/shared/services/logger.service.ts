/**
 * Structured logging service built on pino.
 *
 * Usage:
 *   import { logger, createLogger } from '@/shared/services/logger.service.js';
 *
 *   // Module-level logger (adds { module } to every log)
 *   const log = createLogger('ScrapingService');
 *   log.info({ jobId, supplier }, 'Job started');
 *   log.debug({ batch: 3, total: 17 }, 'Batch saved');    // hidden at LOG_LEVEL=info
 *   log.error({ err }, 'DB write failed');
 *
 *   // Job-scoped child logger (adds jobId, supplier, companyId to every log)
 *   const jobLog = log.child({ jobId: 'abc', supplier: 'musgrave', companyId: '123' });
 *   jobLog.info('Scrape started');
 *
 * In production:
 *   - JSON to stdout (for log aggregators)
 *   - Optional file transport with rotation (LOG_FILE_ENABLED=true)
 *
 * In development:
 *   - Pretty-printed, colorized output via pino-pretty
 */

import pino from 'pino';
import { getRequestContext } from './request-context.js';

// ---------------------------------------------------------------------------
// Configuration — read from env with sensible defaults.
// We deliberately avoid importing env.ts here to prevent circular deps
// (env.ts is a plain config module, but logger may be used very early).
// ---------------------------------------------------------------------------

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const isDev = NODE_ENV === 'development';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const;

function getValidatedLogLevel(value: string): (typeof LOG_LEVELS)[number] {
  if (!LOG_LEVELS.includes(value as (typeof LOG_LEVELS)[number])) {
    throw new Error(`Invalid LOG_LEVEL: "${value}". Must be one of: ${LOG_LEVELS.join(', ')}`);
  }
  return value as (typeof LOG_LEVELS)[number];
}

const LOG_LEVEL = getValidatedLogLevel(process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'));

const LOG_FILE_ENABLED =
  (process.env.LOG_FILE_ENABLED ?? (isDev ? 'false' : 'true')).toLowerCase() === 'true' ||
  process.env.LOG_FILE_ENABLED === '1';

const LOG_FILE_PATH = process.env.LOG_FILE_PATH ?? './logs/app.log';
const LOG_FILE_MAX_SIZE = process.env.LOG_FILE_MAX_SIZE ?? '10m';
const LOG_FILE_MAX_FILES = Number.parseInt(process.env.LOG_FILE_MAX_FILES ?? '5', 10);

// ---------------------------------------------------------------------------
// Build transports
// ---------------------------------------------------------------------------

function buildTransports(): pino.TransportMultiOptions | pino.TransportSingleOptions {
  const targets: pino.TransportTargetOptions[] = [];

  if (isDev) {
    // Pretty print to stdout in development
    targets.push({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
        messageFormat: '{if module}[{module}]{end} {msg}',
      },
      level: LOG_LEVEL,
    });
  } else {
    // JSON to stdout in production
    targets.push({
      target: 'pino/file',
      options: { destination: 1 }, // fd 1 = stdout
      level: LOG_LEVEL,
    });
  }

  if (LOG_FILE_ENABLED) {
    targets.push({
      target: 'pino-roll',
      options: {
        file: LOG_FILE_PATH,
        frequency: 'daily',
        limit: {
          count: LOG_FILE_MAX_FILES,
        },
        size: LOG_FILE_MAX_SIZE,
        mkdir: true,
      },
      level: LOG_LEVEL,
    });
  }

  return { targets };
}

// ---------------------------------------------------------------------------
// Root logger instance
// ---------------------------------------------------------------------------

/**
 * Defense-in-depth redact list. Anything logged at these paths is replaced
 * with `[REDACTED]` before reaching a transport. Paths cover the obvious
 * shapes that leak through error/request objects — HTTP headers, request
 * bodies, Supabase response payloads, and credential records. This will not
 * save us from a log line that embeds a secret in a format string, so use
 * structured fields and never log raw tokens or password strings.
 */
const REDACT_PATHS = [
  // Auth headers — request and response objects
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  'headers.cookie',
  'authorization',
  'cookie',
  // Request / response bodies
  'body.password',
  'body.p_password',
  'body.apiToken',
  'body.api_token',
  'body.token',
  'body.access_token',
  'body.refresh_token',
  'body.secret',
  // Common credential field names we pass around in-process
  'password',
  'p_password',
  'apiToken',
  'api_token',
  'accessToken',
  'access_token',
  'refresh_token',
  'secret',
  'password_secret_id',
  '*.password',
  '*.apiToken',
  '*.access_token',
  '*.refresh_token',
];

export const logger = pino({
  level: LOG_LEVEL,
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },
  transport: buildTransports() as pino.TransportMultiOptions,
  /**
   * Pino mixin runs on every log line. Pulls correlation id (and any
   * future request-scoped fields) off AsyncLocalStorage so code that
   * doesn't know about the request context still gets tagged logs.
   */
  mixin() {
    const ctx = getRequestContext();
    if (!ctx) return {};
    return {
      correlation_id: ctx.correlationId,
      ...(ctx.userId ? { user_id: ctx.userId } : {}),
      ...(ctx.route ? { route: ctx.route } : {}),
    };
  },
});

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

/**
 * Create a child logger scoped to a module.
 * Every log entry will include `{ module: "<name>" }`.
 *
 * @example
 *   const log = createLogger('BrowserService');
 *   log.info('Browser launched');
 *   // => { "level": "info", "module": "BrowserService", "msg": "Browser launched" }
 */
export function createLogger(module: string): pino.Logger {
  return logger.child({ module });
}

/**
 * Create a child logger scoped to a specific scrape job.
 * Adds module + job context to every log entry automatically.
 *
 * @example
 *   const jobLog = createJobLogger('ScrapingService', {
 *     jobId: 'j-123',
 *     supplier: 'musgrave',
 *     companyId: 'c-456',
 *   });
 *   jobLog.info({ totalFetched: 1200 }, 'Scrape completed');
 */
export function createJobLogger(
  module: string,
  context: { jobId?: string; supplier?: string; companyId?: string }
): pino.Logger {
  return logger.child({ module, ...context });
}
