/**
 * Translate Supabase/PostgREST errors into the right AppError subclass.
 *
 * Controllers historically did `throw new BadRequestError(error.message)` for
 * every Supabase failure, which masked two real signals:
 *   - 42501 (RLS denial) became a 400 instead of 403
 *   - PGRST116 (no row) became a 400 instead of 404
 *   - PGRST301 (JWT expired) became a 400 instead of 401
 *   - network / pool exhaustion became a 400 instead of 503
 *
 * Call sites should narrow to this helper so error taxonomy stays accurate
 * and the frontend can branch on HTTP status.
 */

import type { PostgrestError } from '@supabase/supabase-js';
import {
  AppError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  UnauthorizedError,
} from './AppError.js';

export function isPostgrestError(value: unknown): value is PostgrestError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    'code' in value &&
    typeof (value as { code?: unknown }).code === 'string'
  );
}

/**
 * Map a PostgrestError (or unknown thrown value) to an AppError instance.
 * `resourceLabel` is used only when a 404 is implied by the code (e.g. single()
 * returned no rows) and controllers want a friendlier "X not found" message.
 */
export function toAppError(error: unknown, resourceLabel?: string): AppError {
  if (error instanceof AppError) return error;

  if (!isPostgrestError(error)) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    return new ServiceUnavailableError(message, 'DB_UNAVAILABLE');
  }

  const { code, message } = error;

  switch (code) {
    // PostgREST: no rows returned by single()
    case 'PGRST116':
      return new NotFoundError(resourceLabel ? `${resourceLabel} not found` : 'Resource not found');
    // PostgREST: JWT expired / auth failure
    case 'PGRST301':
    case 'PGRST302':
      return new UnauthorizedError(message);
    // Postgres: insufficient_privilege → RLS denial
    case '42501':
      return new ForbiddenError(message, 'RLS_DENIED');
    // Postgres: unique_violation
    case '23505':
      return new ConflictError(message, 'UNIQUE_VIOLATION');
    // Postgres: foreign_key_violation
    case '23503':
      return new BadRequestError(message, 'FK_VIOLATION');
    // Postgres: not_null_violation / check_violation
    case '23502':
    case '23514':
      return new BadRequestError(message, 'CONSTRAINT_VIOLATION');
    default:
      // Networking, timeouts, pool exhaustion → upstream failure.
      if (code.startsWith('08') || code === 'PGRST000') {
        return new ServiceUnavailableError(message, 'DB_UNAVAILABLE');
      }
      return new BadRequestError(message);
  }
}

/**
 * Convenience wrapper for the common pattern `if (error) throw ...`.
 */
export function throwIfSupabaseError(error: unknown, resourceLabel?: string): void {
  if (!error) return;
  throw toAppError(error, resourceLabel);
}
