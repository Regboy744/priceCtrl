import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { AppError, ValidationError } from '../errors/AppError.js';
import { createLogger } from '../services/logger.service.js';

const log = createLogger('ErrorMiddleware');

interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    statusCode: number;
    errors?: Record<string, string[]>;
    stack?: string;
  };
}

/**
 * Global error handling middleware.
 * Converts errors to consistent JSON responses.
 */
export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log error for debugging
  log.error({ err, name: err.name }, err.message);

  // Handle AppError instances
  if (err instanceof AppError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        message: err.message,
        code: err.code,
        statusCode: err.statusCode,
      },
    };

    // Include validation errors if present
    if (err instanceof ValidationError) {
      response.error.errors = err.errors;
    }

    // Include stack trace in development
    if (env.isDev) {
      response.error.stack = err.stack;
    }

    res.status(err.statusCode).json(response);
    return;
  }

  // Handle Supabase errors
  if (err.name === 'PostgrestError' || 'code' in err) {
    const supabaseError = err as { code?: string; message: string; details?: string };
    const response: ErrorResponse = {
      success: false,
      error: {
        message: supabaseError.message,
        code: supabaseError.code ?? 'DATABASE_ERROR',
        statusCode: 500,
      },
    };

    if (env.isDev) {
      response.error.stack = err.stack;
    }

    res.status(500).json(response);
    return;
  }

  // Handle unknown errors
  const response: ErrorResponse = {
    success: false,
    error: {
      message: env.isProd ? 'An unexpected error occurred' : err.message,
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    },
  };

  if (env.isDev) {
    response.error.stack = err.stack;
  }

  res.status(500).json(response);
}

/**
 * 404 Not Found handler for unmatched routes.
 */
export function notFoundMiddleware(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      message: `Route not found: ${req.method} ${req.path}`,
      code: 'ROUTE_NOT_FOUND',
      statusCode: 404,
    },
  });
}

/**
 * Async handler wrapper to catch errors in async route handlers.
 */
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
