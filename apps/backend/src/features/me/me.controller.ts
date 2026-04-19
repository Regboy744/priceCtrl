import {
  type Role,
  permissionsForRole,
  uiPermissionsForRole,
} from '@pricectrl/contracts/permissions';
import { type Request, type Response, Router } from 'express';
import { UnauthorizedError } from '../../shared/errors/AppError.js';
import { authMiddleware } from '../../shared/middleware/auth.middleware.js';

export const meRouter: Router = Router();

/**
 * GET /api/v1/me
 *
 * Returns the authenticated user's identity, scope claims, and the
 * permission lists computed from the shared registry. Frontend uses
 * `ui_permissions` to decide what UI affordances to render and
 * `permissions` for client-side defensive checks only — real
 * enforcement still happens in backend middleware + RLS.
 */
meRouter.get('/', authMiddleware, (req: Request, res: Response) => {
  const profile = req.user?.profile;
  if (!profile) {
    throw new UnauthorizedError('Authentication required');
  }
  const role = profile.role as Role;
  res.json({
    email: req.user?.email ?? '',
    profile,
    permissions: permissionsForRole(role),
    ui_permissions: uiPermissionsForRole(role),
  });
});
