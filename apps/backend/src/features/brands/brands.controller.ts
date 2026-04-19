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
 * GET /api/v1/brands
 * List brands. Optional `?activeOnly=true`.
 */
router.get(
  '/',
  requirePermission('brands:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const activeOnly = req.query.activeOnly === 'true';
    const token = req.accessToken!;

    let query = createUserClient(token)
      .from('brands')
      .select('id, name, is_active')
      .order('name', { ascending: true });

    if (activeOnly) query = query.eq('is_active', true);

    const { data, error } = await query;
    throwIfSupabaseError(error);
    res.json(data ?? []);
  })
);

export const brandsRouter: Router = router;
