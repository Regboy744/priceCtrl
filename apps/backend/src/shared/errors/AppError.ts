/**
 * Base application error class.
 * Extends the built-in Error class with additional properties for HTTP responses.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);

    // Set the prototype explicitly for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * 400 Bad Request - Invalid input or request format
 */
export class BadRequestError extends AppError {
  constructor(message = 'Bad request', code = 'BAD_REQUEST') {
    super(message, 400, code);
    Object.setPrototypeOf(this, BadRequestError.prototype);
  }
}

/**
 * 401 Unauthorized - Missing or invalid authentication
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    super(message, 401, code);
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

/**
 * 403 Forbidden - Authenticated but not allowed
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN') {
    super(message, 403, code);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

/**
 * 404 Not Found - Resource doesn't exist
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(message, 404, code);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * 409 Conflict - Resource already exists or state conflict
 */
export class ConflictError extends AppError {
  constructor(message = 'Conflict', code = 'CONFLICT') {
    super(message, 409, code);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * 422 Unprocessable Entity - Validation errors
 */
export class ValidationError extends AppError {
  public readonly errors: Record<string, string[]>;

  constructor(errors: Record<string, string[]>, message = 'Validation failed') {
    super(message, 422, 'VALIDATION_ERROR');
    this.errors = errors;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * 429 Too Many Requests - Rate limiting
 */
export class RateLimitError extends AppError {
  public readonly retryAfter?: number;

  constructor(message = 'Too many requests', retryAfter?: number) {
    super(message, 429, 'RATE_LIMIT');
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * 500 Internal Server Error - Unexpected server errors
 */
export class InternalError extends AppError {
  constructor(message = 'Internal server error', code = 'INTERNAL_ERROR') {
    super(message, 500, code, false);
    Object.setPrototypeOf(this, InternalError.prototype);
  }
}

/**
 * 503 Service Unavailable - External service failures
 */
export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service unavailable', code = 'SERVICE_UNAVAILABLE') {
    super(message, 503, code);
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
  }
}

/**
 * Scraping-specific errors
 */
export class ScrapingError extends AppError {
  public readonly supplierId: string;
  public readonly phase: string;

  constructor(message: string, supplierId: string, phase = 'unknown', code = 'SCRAPING_ERROR') {
    super(message, 500, code);
    this.supplierId = supplierId;
    this.phase = phase;
    Object.setPrototypeOf(this, ScrapingError.prototype);
  }
}

export class LoginError extends ScrapingError {
  constructor(message: string, supplierId: string) {
    super(message, supplierId, 'login', 'LOGIN_ERROR');
    Object.setPrototypeOf(this, LoginError.prototype);
  }
}

export class NavigationError extends ScrapingError {
  constructor(message: string, supplierId: string) {
    super(message, supplierId, 'navigation', 'NAVIGATION_ERROR');
    Object.setPrototypeOf(this, NavigationError.prototype);
  }
}

export class ExtractionError extends ScrapingError {
  constructor(message: string, supplierId: string) {
    super(message, supplierId, 'extraction', 'EXTRACTION_ERROR');
    Object.setPrototypeOf(this, ExtractionError.prototype);
  }
}
