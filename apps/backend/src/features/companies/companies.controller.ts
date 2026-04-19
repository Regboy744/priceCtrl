import { type Request, type Response, Router } from 'express';
import { createUserClient } from '../../shared/database/supabase.js';
import { BadRequestError } from '../../shared/errors/AppError.js';
import { throwIfSupabaseError } from '../../shared/errors/supabaseError.js';
import { authMiddleware } from '../../shared/middleware/auth.middleware.js';
import { asyncHandler } from '../../shared/middleware/error.middleware.js';
import { requirePermission } from '../../shared/middleware/requirePermission.js';

const router = Router();

router.use(authMiddleware);

const COMPANY_WITH_BRAND = `
  *,
  brands (
    id,
    name
  )
`;

/**
 * GET /api/v1/companies
 * List companies (with brand). Scope enforced by RLS via userClient.
 */
router.get(
  '/',
  requirePermission('companies:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.accessToken!;
    const { data, error } = await createUserClient(token)
      .from('companies')
      .select(COMPANY_WITH_BRAND)
      .order('name', { ascending: true });

    throwIfSupabaseError(error);
    res.json(data ?? []);
  })
);

/**
 * GET /api/v1/companies/:id
 */
router.get(
  '/:id',
  requirePermission('companies:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.accessToken!;
    const { data, error } = await createUserClient(token)
      .from('companies')
      .select(COMPANY_WITH_BRAND)
      .eq('id', String(req.params.id))
      .single();

    throwIfSupabaseError(error);
    res.json(data);
  })
);

/**
 * POST /api/v1/companies
 */
router.post(
  '/',
  requirePermission('companies:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, brand_id, phone, email, is_active } = req.body ?? {};
    if (!name) throw new BadRequestError('name is required');

    const token = req.accessToken!;
    const { data, error } = await createUserClient(token)
      .from('companies')
      .insert({
        name,
        brand_id,
        phone,
        email,
        is_active: is_active ?? true,
      })
      .select()
      .single();

    throwIfSupabaseError(error);
    res.status(201).json(data);
  })
);

/**
 * PATCH /api/v1/companies/:id
 */
router.patch(
  '/:id',
  requirePermission('companies:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, brand_id, phone, email, is_active } = req.body ?? {};

    const token = req.accessToken!;
    const { data, error } = await createUserClient(token)
      .from('companies')
      .update({ name, brand_id, phone, email, is_active })
      .eq('id', String(req.params.id))
      .select()
      .single();

    throwIfSupabaseError(error);
    res.json(data);
  })
);

/**
 * DELETE /api/v1/companies/:id
 * Cascades via FK to locations, orders, etc.
 */
router.delete(
  '/:id',
  requirePermission('companies:delete'),
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.accessToken!;
    const { error } = await createUserClient(token)
      .from('companies')
      .delete()
      .eq('id', String(req.params.id));

    throwIfSupabaseError(error);
    res.status(204).send();
  })
);

export const companiesRouter: Router = router;
