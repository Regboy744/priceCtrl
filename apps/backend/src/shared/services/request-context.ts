/**
 * Request-scoped context propagated via Node's AsyncLocalStorage.
 *
 * Middleware at the top of the Express chain generates a correlation id
 * (or reads one from `x-correlation-id` for cross-service traces) and
 * stores it here. Anything running inside the request — domain code,
 * DB calls, background awaits — can pull the id back out without
 * every function signature growing a `correlationId` parameter.
 *
 * The pino logger mixin consumes this store so every log line emitted
 * during a request automatically carries the correlation id.
 */

import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  correlationId: string;
  userId?: string;
  route?: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

export function getCorrelationId(): string | undefined {
  return requestContextStorage.getStore()?.correlationId;
}
