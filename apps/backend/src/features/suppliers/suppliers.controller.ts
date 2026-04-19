import { type Request, type Response, Router } from 'express';
import { createUserClient } from '../../shared/database/supabase.js';
import { BadRequestError } from '../../shared/errors/AppError.js';
import { throwIfSupabaseError } from '../../shared/errors/supabaseError.js';
import { authMiddleware } from '../../shared/middleware/auth.middleware.js';
import { asyncHandler } from '../../shared/middleware/error.middleware.js';
import { requirePermission } from '../../shared/middleware/requirePermission.js';

const router = Router();

router.use(authMiddleware);

/**
 * GET /api/v1/suppliers
 * List suppliers. Optional `?activeOnly=true` filter.
 */
router.get(
  '/',
  requirePermission('suppliers:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const activeOnly = req.query.activeOnly === 'true';
    const token = req.accessToken!;

    let query = createUserClient(token)
      .from('suppliers')
      .select('*')
      .order('name', { ascending: true });

    if (activeOnly) query = query.eq('is_active', true);

    const { data, error } = await query;
    throwIfSupabaseError(error);
    res.json(data ?? []);
  })
);

/**
 * GET /api/v1/suppliers/:id
 */
router.get(
  '/:id',
  requirePermission('suppliers:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.accessToken!;
    const { data, error } = await createUserClient(token)
      .from('suppliers')
      .select('*')
      .eq('id', String(req.params.id))
      .single();

    throwIfSupabaseError(error);
    res.json(data);
  })
);

export const suppliersRouter: Router = router;
