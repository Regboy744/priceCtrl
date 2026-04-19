import { createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { LRUCache } from 'lru-cache';
import { createUserClient, getAnonClient } from '../database/supabase.js';
import { UnauthorizedError } from '../errors/AppError.js';
import { createLogger } from '../services/logger.service.js';
import type { UserProfile } from '../types/database.types.js';

const log = createLogger('AuthMiddleware');

type CachedAuth = {
  userId: string;
  email: string;
  profile: UserProfile | null;
};

/**
 * Per-token cache of resolved identity. Each request to an authed route was
 * hitting Supabase twice (JWT verification + user_profiles lookup), adding
 * ~200-400ms p50. Cache by token hash — never store the raw token as a key —
 * and keep the TTL short so revoked sessions stop working quickly.
 */
const authCache = new LRUCache<string, CachedAuth>({
  max: 2000,
  ttl: 30_000,
});

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        profile: UserProfile | null;
      };
      accessToken?: string;
    }
  }
}

/**
 * Middleware to validate Supabase JWT token.
 * Extracts user info and attaches it to the request.
 */
export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.slice(7); // Remove 'Bearer ' prefix
    req.accessToken = token;

    const cacheKey = hashToken(token);
    const cached = authCache.get(cacheKey);
    if (cached) {
      req.user = {
        id: cached.userId,
        email: cached.email,
        profile: cached.profile,
      };
      return next();
    }

    // Validate token with Supabase (anon client — just verifies the JWT)
    const {
      data: { user },
      error,
    } = await getAnonClient().auth.getUser(token);

    if (error || !user) {
      throw new UnauthorizedError('Invalid or expired token');
    }

    // Fetch user profile with the user's JWT attached so RLS policies
    // (is_master / company_id scope) evaluate against their claims.
    const { data: profile } = await createUserClient(token)
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    authCache.set(cacheKey, {
      userId: user.id,
      email: user.email ?? '',
      profile,
    });

    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email ?? '',
      profile,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional auth middleware - doesn't fail if no token present.
 * Useful for endpoints that work differently for authenticated vs anonymous users.
 */
export async function optionalAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      // No token, continue without user context
      return next();
    }

    const token = authHeader.slice(7);
    req.accessToken = token;

    const cacheKey = hashToken(token);
    const cached = authCache.get(cacheKey);
    if (cached) {
      req.user = {
        id: cached.userId,
        email: cached.email,
        profile: cached.profile,
      };
      return next();
    }

    const {
      data: { user },
    } = await getAnonClient().auth.getUser(token);

    if (user) {
      const { data: profile } = await createUserClient(token)
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      authCache.set(cacheKey, {
        userId: user.id,
        email: user.email ?? '',
        profile,
      });

      req.user = {
        id: user.id,
        email: user.email ?? '',
        profile,
      };
    }

    next();
  } catch (err) {
    // Log instead of silent-swallow. We still continue (this is the
    // *optional* auth path), but a repeated failure here likely means
    // Supabase is down or a malformed token is in flight — both worth
    // knowing about at warn level.
    log.warn({ err }, 'optionalAuthMiddleware failed; continuing unauthenticated');
    next();
  }
}
