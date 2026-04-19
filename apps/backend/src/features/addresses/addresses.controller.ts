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
 * GET /api/v1/addresses/company/:companyId
 * Fetch the single company-level address (location_id is null).
 */
router.get(
  '/company/:companyId',
  requirePermission('addresses:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.accessToken!;
    const { data, error } = await createUserClient(token)
      .from('addresses')
      .select('*')
      .eq('company_id', String(req.params.companyId))
      .is('location_id', null)
      .maybeSingle();

    throwIfSupabaseError(error);
    res.json(data);
  })
);

/**
 * GET /api/v1/addresses/:id
 */
router.get(
  '/:id',
  requirePermission('addresses:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.accessToken!;
    const { data, error } = await createUserClient(token)
      .from('addresses')
      .select('*')
      .eq('id', String(req.params.id))
      .single();

    throwIfSupabaseError(error);
    res.json(data);
  })
);

/**
 * POST /api/v1/addresses
 */
router.post(
  '/',
  requirePermission('addresses:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.accessToken!;
    const {
      company_id,
      street_address,
      address_line2,
      city,
      county,
      eircode,
      country,
      address_type,
      is_active,
    } = req.body ?? {};

    if (!company_id || !street_address) {
      throw new BadRequestError('company_id and street_address are required');
    }

    const { data, error } = await createUserClient(token)
      .from('addresses')
      .insert({
        company_id,
        street_address,
        address_line2,
        city,
        county,
        eircode,
        country: country ?? 'Ireland',
        address_type: address_type ?? 'headoffice',
        is_active: is_active ?? true,
      })
      .select()
      .single();

    throwIfSupabaseError(error);
    res.status(201).json(data);
  })
);

/**
 * PATCH /api/v1/addresses/:id
 */
router.patch(
  '/:id',
  requirePermission('addresses:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.accessToken!;
    const {
      street_address,
      address_line2,
      city,
      county,
      eircode,
      country,
      address_type,
      is_active,
    } = req.body ?? {};

    const { data, error } = await createUserClient(token)
      .from('addresses')
      .update({
        street_address,
        address_line2,
        city,
        county,
        eircode,
        country,
        address_type,
        is_active,
      })
      .eq('id', String(req.params.id))
      .select()
      .single();

    throwIfSupabaseError(error);
    res.json(data);
  })
);

/**
 * DELETE /api/v1/addresses/:id
 */
router.delete(
  '/:id',
  requirePermission('addresses:delete'),
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.accessToken!;
    const { error } = await createUserClient(token)
      .from('addresses')
      .delete()
      .eq('id', String(req.params.id));

    throwIfSupabaseError(error);
    res.status(204).send();
  })
);

export const addressesRouter: Router = router;
