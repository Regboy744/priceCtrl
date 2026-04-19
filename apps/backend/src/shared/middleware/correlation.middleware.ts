/**
 * Correlation-id middleware.
 *
 * Reads `x-correlation-id` off the incoming request (for cross-service
 * traces) or generates a new one. Runs the rest of the Express chain
 * inside an AsyncLocalStorage context so every log line emitted during
 * the request is automatically tagged.
 *
 * Echoes the id back on the response headers so clients and downstream
 * services can thread it through their own logs.
 */

import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { requestContextStorage } from '../services/request-context.js';

export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-correlation-id');
  const correlationId = incoming && incoming.length > 0 ? incoming : randomUUID();
  res.setHeader('x-correlation-id', correlationId);
  requestContextStorage.run({ correlationId, route: `${req.method} ${req.path}` }, () => next());
}
