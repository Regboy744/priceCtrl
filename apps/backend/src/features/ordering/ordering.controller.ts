import type { SupplierConstraint } from '@pricectrl/contracts/priceCheck';
import { type Request, type Response, Router } from 'express';
import { createUserClient } from '../../shared/database/supabase.js';
import { BadRequestError, ForbiddenError } from '../../shared/errors/AppError.js';
import { throwIfSupabaseError } from '../../shared/errors/supabaseError.js';
import { authMiddleware } from '../../shared/middleware/auth.middleware.js';
import { asyncHandler } from '../../shared/middleware/error.middleware.js';
import { requirePermission } from '../../shared/middleware/requirePermission.js';
import { createLogger } from '../../shared/services/logger.service.js';
import { validateSubmission } from './domain/validation.js';
import { getAllOrderHandlers } from './ordering.registry.js';
import { orderingService } from './ordering.service.js';
import { OrderSubmissionRequestSchema } from './ordering.types.js';

const ORDER_LIST_SELECT = `
  id,
  order_date,
  total_amount,
  notes,
  created_at,
  locations!inner (
    id,
    name,
    location_number,
    company_id
  ),
  user_profiles (
    id,
    first_name,
    last_name
  )
`;

const ORDER_DETAIL_SELECT = `
  id,
  order_date,
  total_amount,
  notes,
  created_at,
  locations (
    id,
    name,
    location_number
  ),
  user_profiles (
    id,
    first_name,
    last_name
  ),
  order_items (
    id,
    quantity,
    unit_price,
    total_price,
    baseline_unit_price,
    override_reason,
    master_products (
      id,
      description,
      article_code,
      ean_code,
      account,
      unit_size
    ),
    supplier_products (
      id,
      suppliers (
        id,
        name
      )
    )
  )
`;

const DASHBOARD_ORDERS_SELECT = `
  id,
  order_date,
  total_amount,
  location_id,
  locations!inner (
    company_id
  )
`;

const DASHBOARD_ORDER_ITEMS_SELECT = `
  id,
  order_id,
  master_product_id,
  quantity,
  unit_price,
  total_price,
  baseline_unit_price,
  override_reason,
  master_products (
    id,
    description,
    article_code,
    unit_size
  ),
  supplier_products (
    supplier_id,
    suppliers (
      id,
      name
    )
  )
`;

const SAVINGS_SELECT = `
  id,
  company_id,
  order_item_id,
  baseline_price,
  chosen_price,
  best_external_price,
  delta_vs_baseline,
  is_saving,
  savings_percentage,
  order_items!inner(order_id)
`;

const splitIds = (raw: unknown): string[] => {
  if (typeof raw !== 'string' || !raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

const router = Router();
const log = createLogger('OrderController');

// All routes require authentication
router.use(authMiddleware);

/**
 * POST /api/v1/orders/submit
 * Submit orders to multiple suppliers.
 *
 * @body company_id - Company UUID
 * @body location_id - Location UUID (for credentials lookup)
 * @body supplier_orders - Array of { supplier_id, items: [...] }
 *
 * @returns { success, results, summary }
 */
router.post(
  '/submit',
  requirePermission('orders:send'),
  asyncHandler(async (req: Request, res: Response) => {
    // Validate request body
    const parseResult = OrderSubmissionRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      const errors = parseResult.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join(', ');
      throw new BadRequestError(`Invalid request: ${errors}`);
    }

    const { company_id, location_id, supplier_orders } = parseResult.data;

    // Verify user has access to this company. Master role operates across
    // companies (frontend /app/companies/:id routes), so bypass the strict
    // owner check for them — matches priceCheck behaviour.
    const userCompanyId = req.user?.profile?.company_id;
    const userRole = req.user?.profile?.role;
    if (userRole !== 'master' && userCompanyId !== company_id) {
      throw new ForbiddenError('Access denied to this company');
    }

    const userId = req.user?.id;
    if (!userId) {
      throw new ForbiddenError('Authentication required');
    }

    // Pre-flight validation. Today these are advisory — handlers still
    // reject bad payloads themselves (so the warning + failure surface
    // tells the same story). A future phase may promote specific codes
    // to hard 400s.
    const constraints = new Map<string, SupplierConstraint>();
    for (const h of getAllOrderHandlers()) {
      constraints.set(h.supplierId, {
        requires_internal_product_id: h.config.requiresProductId,
        max_items_per_request: h.config.maxItemsPerRequest,
      });
    }
    const warnings = validateSubmission({
      request: { company_id, location_id, supplier_orders },
      constraints,
    });
    if (warnings.length > 0) {
      log.warn({ warnings, companyId: company_id }, 'Submission validation warnings');
    }

    log.info(
      { companyId: company_id, locationId: location_id, supplierCount: supplier_orders.length },
      'Submitting orders'
    );

    // Submit orders (includes database persistence)
    const result = await orderingService.submitOrders({
      company_id,
      location_id,
      supplier_orders,
      user_id: userId,
    });

    res.json({
      success: true,
      data: result,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  })
);

/**
 * GET /api/v1/orders/handlers
 * List registered order handlers.
 * Useful for debugging and admin purposes.
 */
router.get(
  '/handlers',
  asyncHandler(async (_req: Request, res: Response) => {
    const handlers = getAllOrderHandlers();

    res.json({
      success: true,
      data: handlers.map((h) => ({
        supplier_id: h.supplierId,
        name: h.name,
        strategy: h.config.submissionStrategy,
        basket_url: h.config.basketUrl,
        max_items_per_request: h.config.maxItemsPerRequest,
      })),
    });
  })
);

/**
 * GET /api/v1/orders
 * List orders. Filters: companyId, locationId, dateFrom, dateTo.
 * `shape=dashboard` uses a leaner select (company_id join only).
 */
router.get(
  '/',
  requirePermission('orders:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const { companyId, locationId, dateFrom, dateTo, shape } = req.query;
    const token = req.accessToken!;
    const client = createUserClient(token);
    const selectCols = shape === 'dashboard' ? DASHBOARD_ORDERS_SELECT : ORDER_LIST_SELECT;

    let query = client.from('orders').select(selectCols).order('order_date', { ascending: false });

    if (typeof locationId === 'string' && locationId) {
      query = query.eq('location_id', locationId);
    }
    if (typeof companyId === 'string' && companyId) {
      query = query.eq('locations.company_id', companyId);
    }
    if (typeof dateFrom === 'string' && dateFrom) {
      query = query.gte('order_date', dateFrom);
    }
    if (typeof dateTo === 'string' && dateTo) {
      query = query.lte('order_date', dateTo);
    }

    const { data, error } = await query;
    throwIfSupabaseError(error);
    res.json(data ?? []);
  })
);

/**
 * GET /api/v1/orders/items-count?orderIds=a,b,c
 */
router.get(
  '/items-count',
  requirePermission('order_items:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const orderIds = splitIds(req.query.orderIds);
    if (orderIds.length === 0) {
      res.json([]);
      return;
    }
    const token = req.accessToken!;
    const { data, error } = await createUserClient(token)
      .from('order_items')
      .select('order_id')
      .in('order_id', orderIds);
    throwIfSupabaseError(error);
    res.json(data ?? []);
  })
);

/**
 * GET /api/v1/orders/items-for-stats?orderIds=a,b,c
 */
router.get(
  '/items-for-stats',
  requirePermission('order_items:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const orderIds = splitIds(req.query.orderIds);
    if (orderIds.length === 0) {
      res.json([]);
      return;
    }
    const token = req.accessToken!;
    const { data, error } = await createUserClient(token)
      .from('order_items')
      .select('id, order_id, quantity')
      .in('order_id', orderIds)
      .range(0, 4999);
    throwIfSupabaseError(error);
    res.json(data ?? []);
  })
);

/**
 * GET /api/v1/orders/items-for-dashboard?orderIds=a,b,c
 * Returns order_items with master_product + supplier joins.
 */
router.get(
  '/items-for-dashboard',
  requirePermission('order_items:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const orderIds = splitIds(req.query.orderIds);
    if (orderIds.length === 0) {
      res.json([]);
      return;
    }
    const token = req.accessToken!;
    const { data, error } = await createUserClient(token)
      .from('order_items')
      .select(DASHBOARD_ORDER_ITEMS_SELECT)
      .in('order_id', orderIds)
      .range(0, 4999);
    throwIfSupabaseError(error);
    res.json(data ?? []);
  })
);

/**
 * GET /api/v1/orders/savings?companyId=&orderIds=a,b,c
 * Savings calculations joined to order_items, scoped by company + order ids.
 */
router.get(
  '/savings',
  requirePermission('savings_calculations:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const orderIds = splitIds(req.query.orderIds);
    if (orderIds.length === 0) {
      res.json([]);
      return;
    }
    const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : null;

    const token = req.accessToken!;
    let query = createUserClient(token).from('savings_calculations').select(SAVINGS_SELECT);

    if (companyId) query = query.eq('company_id', companyId);
    query = query.in('order_items.order_id', orderIds).range(0, 4999);

    const { data, error } = await query;
    throwIfSupabaseError(error);
    res.json(data ?? []);
  })
);

/**
 * GET /api/v1/orders/:id
 * Full order detail with items + nested joins.
 */
router.get(
  '/:id',
  requirePermission('orders:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.accessToken!;
    const { data, error } = await createUserClient(token)
      .from('orders')
      .select(ORDER_DETAIL_SELECT)
      .eq('id', String(req.params.id))
      .single();
    throwIfSupabaseError(error);
    res.json(data);
  })
);

export const orderingRouter: Router = router;
