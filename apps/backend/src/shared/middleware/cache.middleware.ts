/**
 * Per-user response cache for hot read endpoints. Supabase RLS scopes rows
 * by user, so cache keys must include the user id to avoid cross-account
 * leaks. Only 2xx JSON responses are stored; errors and 3xx pass through.
 *
 * Bypass with `?fresh=1` when the client needs a guaranteed read-after-write.
 */

import type { NextFunction, Request, Response } from 'express';
import { LRUCache } from 'lru-cache';

interface CachedEntry {
  status: number;
  body: unknown;
}

const cache = new LRUCache<string, CachedEntry>({
  max: 5000,
  ttl: 60_000,
});

const buildKey = (req: Request): string => {
  const userId = req.user?.id ?? 'anon';
  return `${req.method}:${userId}:${req.originalUrl}`;
};

/**
 * Cache successful JSON responses for `ttlMs` (default 60s). Apply AFTER
 * `authMiddleware` so `req.user` is populated for the key.
 */
export const cacheResponse =
  (ttlMs = 60_000) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== 'GET' || req.query.fresh === '1') {
      next();
      return;
    }

    const key = buildKey(req);
    const hit = cache.get(key);
    if (hit) {
      res.status(hit.status).json(hit.body);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(key, { status: res.statusCode, body }, { ttl: ttlMs });
      }
      return originalJson(body);
    };
    next();
  };

export const invalidateUserCache = (userId: string): void => {
  for (const key of cache.keys()) {
    if (key.includes(`:${userId}:`)) cache.delete(key);
  }
};

export const clearResponseCache = (): void => cache.clear();
