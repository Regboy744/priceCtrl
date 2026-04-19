import { type Request, type Response, Router } from 'express';
import { createUserClient } from '../../shared/database/supabase.js';
import { BadRequestError } from '../../shared/errors/AppError.js';
import { throwIfSupabaseError } from '../../shared/errors/supabaseError.js';
import { authMiddleware } from '../../shared/middleware/auth.middleware.js';
import { asyncHandler } from '../../shared/middleware/error.middleware.js';
import { requirePermission } from '../../shared/middleware/requirePermission.js';

const router = Router();

router.use(authMiddleware);

interface ThresholdInput {
  supplier_id: string;
  threshold_percentage: number;
  special_pricing_enabled: boolean;
  is_active: boolean;
}

/**
 * GET /api/v1/company-settings?companyId=<uuid>
 * List company_supplier_settings rows for a company.
 */
router.get(
  '/',
  requirePermission('company_supplier_settings:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const companyId = req.query.companyId;
    if (typeof companyId !== 'string' || !companyId) {
      throw new BadRequestError('companyId query param is required');
    }

    const token = req.accessToken!;
    const { data, error } = await createUserClient(token)
      .from('company_supplier_settings')
      .select('*')
      .eq('company_id', companyId);

    throwIfSupabaseError(error);
    res.json(data ?? []);
  })
);

/**
 * POST /api/v1/company-settings/upsert
 * Bulk upsert threshold settings for a company. Conflict on (company_id, supplier_id).
 * Body: { company_id: string, settings: ThresholdInput[] }
 */
router.post(
  '/upsert',
  requirePermission('company_supplier_settings:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const { company_id, settings } = req.body ?? {};
    if (!company_id || !Array.isArray(settings)) {
      throw new BadRequestError('company_id and settings[] are required');
    }

    const rows = (settings as ThresholdInput[]).map((s) => ({
      company_id,
      supplier_id: s.supplier_id,
      threshold_percentage: s.threshold_percentage,
      special_pricing_enabled: s.special_pricing_enabled,
      is_active: s.is_active,
    }));

    const token = req.accessToken!;
    const { data, error } = await createUserClient(token)
      .from('company_supplier_settings')
      .upsert(rows, {
        onConflict: 'company_id,supplier_id',
        ignoreDuplicates: false,
      })
      .select();

    throwIfSupabaseError(error);
    res.json(data ?? []);
  })
);

/**
 * PATCH /api/v1/company-settings/:id
 * Update a single threshold setting row.
 */
router.patch(
  '/:id',
  requirePermission('company_supplier_settings:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const { threshold_percentage, special_pricing_enabled, is_active } = req.body ?? {};

    const token = req.accessToken!;
    const { data, error } = await createUserClient(token)
      .from('company_supplier_settings')
      .update({
        threshold_percentage,
        special_pricing_enabled,
        is_active,
      })
      .eq('id', String(req.params.id))
      .select()
      .single();

    throwIfSupabaseError(error);
    res.json(data);
  })
);

export const companySettingsRouter: Router = router;
