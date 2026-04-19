/**
 * Rate-limit middleware. Per-route limiters protect expensive or sensitive
 * endpoints (auth, scraping triggers, bulk import). All limiters skip in
 * non-production so local development isn't blocked.
 *
 * The user identifier prefers `req.user.id` (set by `authMiddleware`) and
 * falls back to the request IP for anonymous routes.
 */

import type { Request } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';

const skip = (): boolean => !env.isProd;

const userOrIpKey = (req: Request): string => {
  const userId = req.user?.id;
  if (userId) return `user:${userId}`;
  return ipKeyGenerator(req.ip ?? '');
};

const standardOptions = {
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  skip,
};

/**
 * Global limiter mounted on the app — defends against scrape-style abuse.
 * 200 req/min per IP is generous for a normal frontend session.
 */
export const globalLimiter = rateLimit({
  ...standardOptions,
  windowMs: 60 * 1000,
  limit: 200,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
  message: { success: false, error: { message: 'Too many requests', code: 'RATE_LIMIT' } },
});

/**
 * Login / credential test endpoints. Strict to slow brute-force attempts.
 */
export const authLimiter = rateLimit({
  ...standardOptions,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
  message: { success: false, error: { message: 'Too many auth attempts', code: 'RATE_LIMIT' } },
});

/**
 * Scraping trigger endpoints. Expensive (browser/HTTP work + DB writes).
 */
export const triggerLimiter = rateLimit({
  ...standardOptions,
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: userOrIpKey,
  message: { success: false, error: { message: 'Too many trigger requests', code: 'RATE_LIMIT' } },
});

/**
 * Bulk-import endpoint. 200mb payloads are cheap to abuse — limit hard.
 */
export const bulkImportLimiter = rateLimit({
  ...standardOptions,
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: userOrIpKey,
  message: { success: false, error: { message: 'Too many bulk imports', code: 'RATE_LIMIT' } },
});
