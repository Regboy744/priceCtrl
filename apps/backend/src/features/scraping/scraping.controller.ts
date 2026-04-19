import { canAccessResource } from '@pricectrl/contracts/permissions';
import { type Request, type Response, Router } from 'express';
import { BadRequestError, NotFoundError } from '../../shared/errors/AppError.js';
import { authMiddleware } from '../../shared/middleware/auth.middleware.js';
import { asyncHandler } from '../../shared/middleware/error.middleware.js';
import { triggerLimiter } from '../../shared/middleware/rateLimit.middleware.js';
import {
  assertResourceAccess,
  claimsFromRequest,
  requirePermission,
} from '../../shared/middleware/requirePermission.js';
import { createLogger } from '../../shared/services/logger.service.js';
import { scrapingScheduler } from './scraping.scheduler.js';
import { scrapingService } from './scraping.service.js';

const router = Router();
const log = createLogger('ScrapingController');

// All scraping routes require authentication
router.use(authMiddleware);

/**
 * GET /api/v1/scraping/status
 * Get overall scraping status and statistics.
 */
router.get(
  '/status',
  asyncHandler(async (_req: Request, res: Response) => {
    const stats = scrapingService.getStats();
    const schedulerStatus = scrapingScheduler.getStatus();
    const scrapers = scrapingService.getScraperInfo();

    res.json({
      success: true,
      data: {
        stats,
        scheduler: schedulerStatus,
        scrapers,
      },
    });
  })
);

/**
 * GET /api/v1/scraping/jobs
 * Get list of recent scraping jobs.
 */
router.get(
  '/jobs',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(Number.parseInt(req.query.limit as string) || 20, 100);
    const status = req.query.status as string | undefined;

    const allJobs = status
      ? scrapingService.getJobsByStatus(status as 'pending' | 'running' | 'completed' | 'failed')
      : scrapingService.getRecentJobs(limit);

    // Scope: only return jobs the requester is allowed to see.
    const claims = claimsFromRequest(req);
    const jobs = allJobs.filter((job) =>
      canAccessResource(claims, { company_id: job.config.companyId })
    );

    // Don't include full product arrays in list response
    const jobSummaries = jobs.map((job) => ({
      id: job.id,
      supplierId: job.config.supplierId,
      locationId: job.config.locationId,
      companyId: job.config.companyId,
      status: job.status,
      isManual: job.config.isManual,
      scrapingMode: job.result?.scrapingMode,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      productCount: job.result?.productCount ?? 0,
      savedCount: job.result?.savedCount ?? 0,
      error: job.result?.error,
    }));

    res.json({
      success: true,
      data: {
        jobs: jobSummaries,
        count: jobSummaries.length,
      },
    });
  })
);

/**
 * GET /api/v1/scraping/jobs/:jobId
 * Get details of a specific job.
 */
router.get(
  '/jobs/:jobId',
  asyncHandler(async (req: Request, res: Response) => {
    const { jobId } = req.params;
    const job = scrapingService.getJob(jobId as string);

    if (!job) {
      throw new NotFoundError(`Job not found: ${jobId}`);
    }

    // Scope: a job belongs to a company; non-master users may only see their own.
    assertResourceAccess(req, { company_id: job.config.companyId });

    res.json({
      success: true,
      data: {
        job: {
          ...job,
          // Include products only if requested
          result: job.result
            ? {
                ...job.result,
                products: req.query.includeProducts === 'true' ? job.result.products : undefined,
              }
            : undefined,
        },
      },
    });
  })
);

/**
 * POST /api/v1/scraping/trigger
 * Manually trigger a scraping job for a company.
 * Requires admin or master role.
 *
 * @param forceBaseline - If true, forces baseline when company is the baseline.
 */
router.post(
  '/trigger',
  triggerLimiter,
  requirePermission('scraping:trigger'),
  asyncHandler(async (req: Request, res: Response) => {
    const { supplierId, companyId, forceBaseline = false } = req.body;

    if (!supplierId || !companyId) {
      throw new BadRequestError('supplierId and companyId are required');
    }

    // Scope: only master can trigger across companies; admin/manager limited to own.
    assertResourceAccess(req, { company_id: companyId });

    const job = await scrapingService.triggerScrape(
      {
        supplierId,
        companyId,
        isManual: true,
      },
      forceBaseline
    );

    res.status(202).json({
      success: true,
      message: 'Scraping job queued',
      data: {
        jobId: job.id,
        status: job.status,
        forceBaseline,
      },
    });
  })
);

/**
 * POST /api/v1/scraping/trigger-all
 * Trigger scraping for all suppliers for a company.
 * Requires admin or master role.
 */
router.post(
  '/trigger-all',
  triggerLimiter,
  requirePermission('scraping:trigger'),
  asyncHandler(async (req: Request, res: Response) => {
    const { companyId } = req.body;

    if (!companyId) {
      throw new BadRequestError('companyId is required');
    }

    assertResourceAccess(req, { company_id: companyId });

    const jobs = await scrapingService.triggerAllScrapers(companyId, true);

    res.status(202).json({
      success: true,
      message: `${jobs.length} scraping jobs queued`,
      data: {
        jobs: jobs.map((job) => ({
          jobId: job.id,
          supplierId: job.config.supplierId,
          status: job.status,
        })),
      },
    });
  })
);

/**
 * POST /api/v1/scraping/trigger-schedule
 * Manually trigger the scheduled scrape (runs for all suppliers/companies).
 * Requires master role.
 */
router.post(
  '/trigger-schedule',
  triggerLimiter,
  requirePermission('scraping:trigger'),
  asyncHandler(async (_req: Request, res: Response) => {
    if (scrapingScheduler.isScrapeRunning()) {
      throw new BadRequestError('A scheduled scrape is already in progress');
    }

    // Run async, don't wait
    scrapingScheduler.triggerManualScrape().catch((error) => {
      log.error({ err: error }, 'Manual schedule trigger error');
    });

    res.status(202).json({
      success: true,
      message: 'Scheduled scrape triggered',
    });
  })
);

/**
 * POST /api/v1/scraping/jobs/:jobId/cancel
 * Cancel a pending job.
 */
router.post(
  '/jobs/:jobId/cancel',
  requirePermission('scraping:trigger'),
  asyncHandler(async (req: Request, res: Response) => {
    const { jobId } = req.params;

    const job = scrapingService.getJob(jobId as string);
    if (!job) {
      throw new BadRequestError('Job cannot be cancelled (not found or not pending)');
    }
    assertResourceAccess(req, { company_id: job.config.companyId });

    const cancelled = scrapingService.cancelJob(jobId as string);

    if (!cancelled) {
      throw new BadRequestError('Job cannot be cancelled (not found or not pending)');
    }

    res.json({
      success: true,
      message: 'Job cancelled',
    });
  })
);

/**
 * GET /api/v1/scraping/scrapers
 * Get list of registered scrapers.
 */
router.get(
  '/scrapers',
  asyncHandler(async (_req: Request, res: Response) => {
    const scrapers = scrapingService.getScraperInfo();

    res.json({
      success: true,
      data: {
        scrapers,
        count: scrapers.length,
      },
    });
  })
);

export const scrapingRouter: Router = router;
