import { type Request, type Response, Router } from 'express';
import { createUserClient } from '../../shared/database/supabase.js';
import { BadRequestError } from '../../shared/errors/AppError.js';
import { throwIfSupabaseError } from '../../shared/errors/supabaseError.js';
import { authMiddleware } from '../../shared/middleware/auth.middleware.js';
import { cacheResponse } from '../../shared/middleware/cache.middleware.js';
import { asyncHandler } from '../../shared/middleware/error.middleware.js';
import { requirePermission } from '../../shared/middleware/requirePermission.js';

const router = Router();

router.use(authMiddleware);
router.use(cacheResponse(60_000));

/**
 * GET /api/v1/locations?companyId=<uuid>
 * List locations. Scope enforced by RLS via userClient:
 *   master  → all companies (companyId filter still applies)
 *   admin   → own company
 *   manager → own location
 */
router.get(
  '/',
  requirePermission('locations:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const companyId = req.query.companyId as string | undefined;
    const withCompany = req.query.withCompany === 'true';
    const activeOnly = req.query.activeOnly === 'true';
    const token = req.accessToken!;
    const client = createUserClient(token);

    const selectCols = withCompany
      ? `id, name, location_number, company_id, company:companies(id, name)`
      : '*';

    let query = client
      .from('locations')
      .select(selectCols)
      .order('location_number', { ascending: true });

    if (companyId) query = query.eq('company_id', companyId);
    if (activeOnly) query = query.eq('is_active', true);

    const { data, error } = await query;
    throwIfSupabaseError(error);
    res.json(data ?? []);
  })
);

/**
 * GET /api/v1/locations/:id?withCompany=true
 */
router.get(
  '/:id',
  requirePermission('locations:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.accessToken!;
    const withCompany = req.query.withCompany === 'true';
    const selectCols = withCompany
      ? `id, name, location_number, company_id, company:companies(id, name)`
      : '*';

    const { data, error } = await createUserClient(token)
      .from('locations')
      .select(selectCols)
      .eq('id', String(req.params.id))
      .single();
    throwIfSupabaseError(error);
    res.json(data);
  })
);

/**
 * POST /api/v1/locations
 */
router.post(
  '/',
  requirePermission('locations:create'),
  asyncHandler(async (req: Request, res: Response) => {
    const { company_id, name, location_number, location_type, is_active } = req.body ?? {};

    if (!company_id || !name) {
      throw new BadRequestError('company_id and name are required');
    }

    const token = req.accessToken!;
    const { data, error } = await createUserClient(token)
      .from('locations')
      .insert({
        company_id,
        name,
        location_number,
        location_type,
        is_active: is_active ?? true,
      })
      .select()
      .single();

    throwIfSupabaseError(error);
    res.status(201).json(data);
  })
);

/**
 * PATCH /api/v1/locations/:id
 */
router.patch(
  '/:id',
  requirePermission('locations:update'),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, location_number, location_type, is_active } = req.body ?? {};

    const token = req.accessToken!;
    const { data, error } = await createUserClient(token)
      .from('locations')
      .update({ name, location_number, location_type, is_active })
      .eq('id', String(req.params.id))
      .select()
      .single();

    throwIfSupabaseError(error);
    res.json(data);
  })
);

/**
 * DELETE /api/v1/locations/:id
 */
router.delete(
  '/:id',
  requirePermission('locations:delete'),
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.accessToken!;
    const { error } = await createUserClient(token)
      .from('locations')
      .delete()
      .eq('id', String(req.params.id));

    throwIfSupabaseError(error);
    res.status(204).send();
  })
);

export const locationsRouter: Router = router;
