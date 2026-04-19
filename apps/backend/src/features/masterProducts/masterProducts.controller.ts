import express, { type Request, type Response, Router } from 'express';
import { escapeIlike } from '../../shared/database/sqlEscape.js';
import { createUserClient } from '../../shared/database/supabase.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';
import { throwIfSupabaseError } from '../../shared/errors/supabaseError.js';
import { authMiddleware } from '../../shared/middleware/auth.middleware.js';
import { asyncHandler } from '../../shared/middleware/error.middleware.js';
import { bulkImportLimiter } from '../../shared/middleware/rateLimit.middleware.js';
import { requirePermission } from '../../shared/middleware/requirePermission.js';
import { createLogger } from '../../shared/services/logger.service.js';

const log = createLogger('MasterProducts');

const BULK_PAGE_SIZE = 1000;
const BULK_INSERT_BATCH = 1000;
const BULK_INSERT_CONCURRENCY = 10;

interface BulkImportRow {
  article_code: string;
  ean_code: string;
  description: string;
  account?: string | null;
  unit_size?: string | null;
}

function writeSseEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

const router = Router();

router.use(authMiddleware);

const SELECT_WITH_BRAND = `
  *,
  brands (
    name
  )
`;

/**
 * GET /api/v1/master-products
 * List master products with optional filters:
 *   ?brandId, ?articleCode (ilike), ?eanCode (ilike), ?description (ilike), ?limit
 */
router.get(
  '/',
  requirePermission('master_products:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.accessToken!;
    const { brandId, articleCode, eanCode, description } = req.query;
    // Cap at 500 to prevent accidental full-table scans. Clients that need
    // more should paginate or use bulk-import.
    const MAX_LIST_LIMIT = 500;
    const parsed = Number.parseInt(String(req.query.limit ?? '100'), 10);
    const limit = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), MAX_LIST_LIMIT) : 100;

    let query = createUserClient(token)
      .from('master_products')
      .select(SELECT_WITH_BRAND)
      .order('description', { ascending: true })
      .limit(limit);

    if (typeof brandId === 'string' && brandId) {
      query = query.eq('brand_id', brandId);
    }
    if (typeof articleCode === 'string' && articleCode) {
      query = query.ilike('article_code', `%${escapeIlike(articleCode)}%`);
    }
    if (typeof eanCode === 'string' && eanCode) {
      query = query.ilike('ean_code', `%${escapeIlike(eanCode)}%`);
    }
    if (typeof description === 'string' && description) {
      query = query.ilike('description', `%${escapeIlike(description)}%`);
    }

    const { data, error } = await query;
    throwIfSupabaseError(error);
    res.json(data ?? []);
  })
);

/**
 * GET /api/v1/master-products/:id
 */
router.get(
  '/:id',
  requirePermission('master_products:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.accessToken!;
    const { data, error } = await createUserClient(token)
      .from('master_products')
      .select(SELECT_WITH_BRAND)
      .eq('id', String(req.params.id))
      .single();

    throwIfSupabaseError(error);
    res.json(data);
  })
);

/**
 * POST /api/v1/master-products
 * Create a master product.
 */
router.post(
  '/',
  requirePermission('master_products:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.accessToken!;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const brandId = typeof body.brand_id === 'string' ? body.brand_id : '';
    const articleCode = typeof body.article_code === 'string' ? body.article_code : '';
    if (!brandId || !articleCode) {
      throw new BadRequestError('brand_id and article_code are required');
    }

    const insertPayload = {
      brand_id: brandId,
      article_code: articleCode,
      ean_code: typeof body.ean_code === 'string' ? body.ean_code : '',
      description: typeof body.description === 'string' ? body.description : '',
      account: typeof body.account === 'string' ? body.account : null,
      unit_size: typeof body.unit_size === 'string' ? body.unit_size : null,
      ean_history: [] as string[],
      is_active: true,
    };

    const { data, error } = await createUserClient(token)
      .from('master_products')
      .insert(insertPayload)
      .select()
      .single();

    throwIfSupabaseError(error);
    res.status(201).json(data);
  })
);

/**
 * PATCH /api/v1/master-products/:id
 * Update master product. If `ean_code` changes, old EAN is appended to
 * `ean_history` (server computes this atomically to avoid lost updates).
 */
router.patch(
  '/:id',
  requirePermission('master_products:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const token = req.accessToken!;
    const client = createUserClient(token);
    const body = (req.body ?? {}) as Record<string, unknown>;

    const ALLOWED_UPDATE_FIELDS = [
      'brand_id',
      'article_code',
      'ean_code',
      'description',
      'account',
      'unit_size',
      'is_active',
    ] as const;

    const update: Record<string, unknown> = {};
    for (const field of ALLOWED_UPDATE_FIELDS) {
      if (field in body) update[field] = body[field];
    }

    if (typeof update.ean_code === 'string') {
      const { data: current, error: fetchError } = await client
        .from('master_products')
        .select('ean_code, ean_history')
        .eq('id', id)
        .single();

      if (fetchError) throw new NotFoundError('Master product not found');

      const history = (current.ean_history as string[] | null) ?? [];
      if (
        current.ean_code &&
        update.ean_code !== current.ean_code &&
        !history.includes(current.ean_code)
      ) {
        update.ean_history = [...history, current.ean_code];
      }
    }

    const { data, error } = await client
      .from('master_products')
      .update(update as never)
      .eq('id', id)
      .select()
      .single();

    throwIfSupabaseError(error);
    res.json(data);
  })
);

/**
 * POST /api/v1/master-products/bulk-import
 * Stream bulk insert progress over Server-Sent Events.
 *
 * Request body: { brandId: string, rows: BulkImportRow[] }
 * Response: text/event-stream with events:
 *   - phase    { phase, message }
 *   - progress { phase, current, total, message }
 *   - complete { inserted, skipped, errors }
 *   - error    { message }
 *
 * Existing (brand_id + article_code) pairs are skipped. Client-initiated
 * disconnect aborts the import between batches.
 */
// 200mb body cap: bulk-import legitimately needs to receive ~200k CSV rows in
// one request. Default global limit (2mb) is too small for this single route.
const bulkImportJsonParser = express.json({ limit: '200mb' });

router.post(
  '/bulk-import',
  bulkImportLimiter,
  bulkImportJsonParser,
  requirePermission('master_products:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const { brandId, rows } = req.body ?? {};

    if (typeof brandId !== 'string' || !brandId) {
      throw new BadRequestError('brandId is required');
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestError('rows must be a non-empty array');
    }

    const token = req.accessToken!;
    const client = createUserClient(token);

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let aborted = false;
    req.on('close', () => {
      if (!res.writableEnded) aborted = true;
    });

    try {
      // Phase 1: fetch existing article codes for this brand
      writeSseEvent(res, 'phase', {
        phase: 'fetching',
        message: 'Fetching existing products...',
      });

      const existing = new Set<string>();
      let offset = 0;
      while (!aborted) {
        const { data, error } = await client
          .from('master_products')
          .select('article_code')
          .eq('brand_id', brandId)
          .range(offset, offset + BULK_PAGE_SIZE - 1);

        if (error) {
          writeSseEvent(res, 'error', { message: error.message });
          res.end();
          return;
        }

        if (!data || data.length === 0) break;

        for (const row of data) {
          if (row.article_code) existing.add(row.article_code.trim());
        }

        writeSseEvent(res, 'progress', {
          phase: 'fetching',
          current: existing.size,
          total: existing.size,
          message: `Fetched ${existing.size} existing products...`,
        });

        if (data.length < BULK_PAGE_SIZE) break;
        offset += BULK_PAGE_SIZE;
      }

      if (aborted) {
        writeSseEvent(res, 'complete', {
          inserted: 0,
          skipped: 0,
          errors: ['Upload cancelled by user'],
        });
        res.end();
        return;
      }

      // Phase 2: partition into inserts vs skipped
      writeSseEvent(res, 'phase', {
        phase: 'processing',
        message: 'Processing CSV rows...',
      });

      const toInsert: Array<
        BulkImportRow & { brand_id: string; ean_history: string[]; is_active: boolean }
      > = [];
      let skipped = 0;

      for (let i = 0; i < rows.length; i++) {
        if (aborted) break;
        const row = rows[i] as BulkImportRow;
        const articleCode = (row?.article_code ?? '').trim();
        if (!articleCode) {
          skipped++;
          continue;
        }

        if (existing.has(articleCode)) {
          skipped++;
        } else {
          toInsert.push({
            brand_id: brandId,
            article_code: articleCode,
            ean_code: (row.ean_code ?? '').trim(),
            description: (row.description ?? '').trim(),
            account: row.account?.trim() || null,
            unit_size: row.unit_size?.trim() || null,
            ean_history: [],
            is_active: true,
          });
          existing.add(articleCode);
        }

        if (i % 1000 === 0 || i === rows.length - 1) {
          writeSseEvent(res, 'progress', {
            phase: 'processing',
            current: i + 1,
            total: rows.length,
            message: `Processed ${i + 1}/${rows.length} rows...`,
          });
        }
      }

      if (aborted) {
        writeSseEvent(res, 'complete', {
          inserted: 0,
          skipped,
          errors: ['Upload cancelled by user'],
        });
        res.end();
        return;
      }

      // Phase 3: batch inserts with per-row fallback. Batches run in
      // fixed-size concurrent waves to overlap network latency without
      // overwhelming Postgres or hitting rate limits.
      let inserted = 0;
      const errors: string[] = [];
      const batches: (typeof toInsert)[] = [];
      for (let i = 0; i < toInsert.length; i += BULK_INSERT_BATCH) {
        batches.push(toInsert.slice(i, i + BULK_INSERT_BATCH));
      }

      // Upsert with ignoreDuplicates is idempotent on the
      // (brand_id, article_code) UNIQUE constraint. Safer than plain insert:
      // concurrent imports, partial retries, and our own phase-1 dedup races
      // no longer crash the batch. Skipped/inserted counting is still driven
      // by the phase-1 existing-set so client reporting stays accurate.
      const runBatch = async (batch: typeof toInsert) => {
        const { error: batchError } = await client.from('master_products').upsert(batch, {
          onConflict: 'brand_id,article_code',
          ignoreDuplicates: true,
        });
        if (!batchError) {
          inserted += batch.length;
          return;
        }
        for (const product of batch) {
          if (aborted) return;
          const { error: rowError } = await client.from('master_products').upsert(product, {
            onConflict: 'brand_id,article_code',
            ignoreDuplicates: true,
          });
          if (rowError) {
            errors.push(`Failed to insert ${product.article_code}: ${rowError.message}`);
          } else {
            inserted++;
          }
        }
      };

      for (let wave = 0; wave < batches.length; wave += BULK_INSERT_CONCURRENCY) {
        if (aborted) {
          errors.push('Upload cancelled by user during inserts');
          break;
        }
        const slice = batches.slice(wave, wave + BULK_INSERT_CONCURRENCY);
        await Promise.all(slice.map(runBatch));

        writeSseEvent(res, 'progress', {
          phase: 'inserting',
          current: inserted,
          total: toInsert.length,
          message: `Inserted ${inserted}/${toInsert.length}...`,
        });
      }

      writeSseEvent(res, 'complete', {
        inserted,
        skipped,
        errors: errors.length ? errors : undefined,
      });
      res.end();
    } catch (err) {
      log.error({ err }, 'Bulk import failed');
      writeSseEvent(res, 'error', {
        message: err instanceof Error ? err.message : 'Unknown error',
      });
      res.end();
    }
  })
);

export const masterProductsRouter: Router = router;
