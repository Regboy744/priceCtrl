import type { NextFunction, Request, Response } from 'express';
import {
  canAccessResource,
  hasPermission,
  type JwtClaims,
  type Permission,
  type Role,
  type ScopedResource,
} from '@pricectrl/contracts/permissions';
import { UnauthorizedError } from '../errors/AppError.js';

/**
 * Gate a route by a registry permission. Role must be loaded by
 * `authMiddleware` first. Keeps route access in sync with the shared
 * permission registry.
 */
export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const role = req.user?.profile?.role as Role | undefined;
    if (!role) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }
    if (!hasPermission(role, permission)) {
      next(new UnauthorizedError(`Permission denied: ${permission}`));
      return;
    }
    next();
  };
}

/**
 * Build JwtClaims from an authenticated request. Throws if profile is
 * missing — callers should run after `authMiddleware`.
 */
export function claimsFromRequest(req: Request): JwtClaims {
  const profile = req.user?.profile;
  if (!profile) {
    throw new UnauthorizedError('Authentication required');
  }
  return {
    role: profile.role as Role,
    company_id: profile.company_id,
    location_id: profile.location_id,
  };
}

/**
 * Throw UnauthorizedError if the authenticated user cannot access the
 * given scoped resource. Master bypasses. Admin matched by company_id.
 * Manager matched by location_id. Resources without scope columns pass.
 */
export function assertResourceAccess(
  req: Request,
  resource: ScopedResource
): void {
  if (!canAccessResource(claimsFromRequest(req), resource)) {
    throw new UnauthorizedError('Resource access denied');
  }
}
