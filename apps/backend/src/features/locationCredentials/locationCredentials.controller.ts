import { type Request, type Response, Router } from 'express';
import { createUserClient } from '../../shared/database/supabase.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';
import { throwIfSupabaseError } from '../../shared/errors/supabaseError.js';
import { authMiddleware } from '../../shared/middleware/auth.middleware.js';
import { asyncHandler } from '../../shared/middleware/error.middleware.js';
import { authLimiter } from '../../shared/middleware/rateLimit.middleware.js';
import { requirePermission } from '../../shared/middleware/requirePermission.js';
import { vaultService } from '../../shared/services/vault.service.js';
import { getScraper } from '../scraping/scraping.registry.js';

const router = Router();

router.use(authMiddleware);

const CREDENTIAL_SELECT = `
  id,
  location_id,
  company_id,
  supplier_id,
  username,
  website_url,
  login_url,
  last_login_status,
  last_login_at,
  last_error_message,
  is_active,
  created_at,
  updated_at,
  suppliers (
    id,
    name
  )
`;

/**
 * GET /api/v1/location-credentials?locationId=<uuid>
 */
router.get(
  '/',
  requirePermission('location_supplier_credentials:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const locationId = req.query.locationId;
    if (typeof locationId !== 'string' || !locationId) {
      throw new BadRequestError('locationId query param is required');
    }

    const token = req.accessToken!;
    const { data, error } = await createUserClient(token)
      .from('location_supplier_credentials')
      .select(CREDENTIAL_SELECT)
      .eq('location_id', locationId)
      .order('created_at', { ascending: false });

    throwIfSupabaseError(error);
    res.json(data ?? []);
  })
);

/**
 * GET /api/v1/location-credentials/health?companyId=&locationId=
 * Credential health view joined to locations + suppliers.
 */
router.get(
  '/health',
  requirePermission('location_supplier_credentials:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const companyId = req.query.companyId;
    if (typeof companyId !== 'string' || !companyId) {
      throw new BadRequestError('companyId query param is required');
    }
    const locationId = typeof req.query.locationId === 'string' ? req.query.locationId : null;

    const token = req.accessToken!;
    let query = createUserClient(token)
      .from('location_supplier_credentials')
      .select(
        `
          id,
          location_id,
          company_id,
          supplier_id,
          last_login_status,
          last_login_at,
          last_error_message,
          is_active,
          locations (
            id,
            name,
            location_number
          ),
          companies (
            id,
            name
          ),
          suppliers (
            id,
            name
          )
        `
      )
      .eq('company_id', companyId)
      .eq('is_active', true);

    if (locationId) query = query.eq('location_id', locationId);

    const { data, error } = await query.order('updated_at', { ascending: false });
    throwIfSupabaseError(error);
    res.json(data ?? []);
  })
);

/**
 * GET /api/v1/location-credentials/:id
 */
router.get(
  '/:id',
  requirePermission('location_supplier_credentials:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.accessToken!;
    const { data, error } = await createUserClient(token)
      .from('location_supplier_credentials')
      .select(CREDENTIAL_SELECT)
      .eq('id', String(req.params.id))
      .single();

    throwIfSupabaseError(error);
    res.json(data);
  })
);

/**
 * POST /api/v1/location-credentials
 * Calls the `create_location_credential` RPC (password goes into vault).
 * Body: { location_id, company_id, supplier_id, username, password, website_url?, login_url? }
 */
router.post(
  '/',
  requirePermission('location_supplier_credentials:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const { location_id, company_id, supplier_id, username, password, website_url, login_url } =
      req.body ?? {};

    if (!location_id || !company_id || !supplier_id || !username) {
      throw new BadRequestError('location_id, company_id, supplier_id, username are required');
    }

    const token = req.accessToken!;
    const client = createUserClient(token);

    const { data, error } = await (
      client.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>
      ) => Promise<{ data: unknown; error: { message: string } | null }>
    )('create_location_credential', {
      p_location_id: location_id,
      p_company_id: company_id,
      p_supplier_id: supplier_id,
      p_username: username,
      p_password: password ?? '',
      p_website_url: website_url ?? undefined,
      p_login_url: login_url ?? undefined,
    });

    throwIfSupabaseError(error);
    res.status(201).json({ id: data });
  })
);

/**
 * PATCH /api/v1/location-credentials/:id
 * Calls `update_location_credential`. Password optional — omit to leave vault unchanged.
 */
router.patch(
  '/:id',
  requirePermission('location_supplier_credentials:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const { username, password, website_url, login_url, is_active } = req.body ?? {};

    const token = req.accessToken!;
    const client = createUserClient(token);

    const { error } = await (
      client.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>
      ) => Promise<{ data: unknown; error: { message: string } | null }>
    )('update_location_credential', {
      p_credential_id: String(req.params.id),
      p_username: username,
      p_password: password || undefined,
      p_website_url: website_url || undefined,
      p_login_url: login_url || undefined,
      p_is_active: is_active,
    });

    throwIfSupabaseError(error);
    res.status(204).send();
  })
);

/**
 * POST /api/v1/location-credentials/:id/test
 * Run the supplier's HTTP login against the stored credential.
 * Updates last_login_status and returns { ok, error? }.
 */
router.post(
  '/:id/test',
  authLimiter,
  requirePermission('location_supplier_credentials:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const credentialId = String(req.params.id);
    const token = req.accessToken!;

    // RLS-gated fetch so admin/manager can only test their own credentials.
    const { data: row, error } = await createUserClient(token)
      .from('location_supplier_credentials')
      .select('id, supplier_id, location_id')
      .eq('id', credentialId)
      .single();

    if (error || !row) throw new NotFoundError('Credential not found');

    const scraper = getScraper(row.supplier_id);
    if (!scraper) {
      throw new BadRequestError(`No scraper registered for supplier ${row.supplier_id}`);
    }

    const creds = await vaultService.getCredentialsForLocation(row.location_id, row.supplier_id);

    try {
      await scraper.initialize();
      await scraper.login(creds);
      await vaultService.updateLoginStatus(credentialId, 'success');
      res.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      await vaultService.updateLoginStatus(credentialId, 'failed', message);
      res.json({ ok: false, error: message });
    } finally {
      try {
        await scraper.cleanup();
      } catch {
        // Cleanup errors non-critical.
      }
    }
  })
);

/**
 * DELETE /api/v1/location-credentials/:id
 * Calls `delete_location_credential` (also removes vault secret).
 */
router.delete(
  '/:id',
  requirePermission('location_supplier_credentials:delete'),
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.accessToken!;
    const client = createUserClient(token);

    const { error } = await (
      client.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>
      ) => Promise<{ data: unknown; error: { message: string } | null }>
    )('delete_location_credential', {
      p_credential_id: String(req.params.id),
    });

    throwIfSupabaseError(error);
    res.status(204).send();
  })
);

export const locationCredentialsRouter: Router = router;
