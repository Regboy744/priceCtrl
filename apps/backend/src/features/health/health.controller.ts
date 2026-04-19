import { type Request, type Response, Router } from 'express';
import { getServiceClient } from '../../shared/database/supabase.js';
import { authMiddleware } from '../../shared/middleware/auth.middleware.js';
import { asyncHandler } from '../../shared/middleware/error.middleware.js';
import { requirePermission } from '../../shared/middleware/requirePermission.js';
import { proxyService } from '../../shared/services/proxy/proxy.service.js';
import { scraperRegistry } from '../scraping/scraping.registry.js';

const router = Router();

/**
 * GET /health
 * Basic health check endpoint.
 */
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const startTime = Date.now();

    // Check database connectivity
    let dbStatus = 'healthy';
    let dbLatency = 0;

    try {
      const dbStart = Date.now();
      const { error } = await getServiceClient().from('suppliers').select('id').limit(1);
      dbLatency = Date.now() - dbStart;

      if (error) {
        dbStatus = 'unhealthy';
      }
    } catch {
      dbStatus = 'unhealthy';
    }

    // Get scraper info
    const scrapers = scraperRegistry.getInfo();

    const response = {
      status: dbStatus === 'healthy' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version ?? '1.0.0',
      checks: {
        database: {
          status: dbStatus,
          latencyMs: dbLatency,
        },
        scrapers: {
          count: scrapers.length,
          registered: scrapers.map((s) => s.name),
        },
      },
      responseTimeMs: Date.now() - startTime,
    };

    const statusCode = response.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(response);
  })
);

/**
 * GET /health/live
 * Kubernetes liveness probe - is the process running?
 */
router.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'alive' });
});

/**
 * GET /health/ready
 * Kubernetes readiness probe - is the service ready to accept traffic?
 */
router.get(
  '/ready',
  asyncHandler(async (_req: Request, res: Response) => {
    // Check if we can connect to the database
    const { error } = await getServiceClient().from('suppliers').select('id').limit(1);

    if (error) {
      res.status(503).json({
        status: 'not ready',
        reason: 'Database connection failed',
      });
      return;
    }

    res.status(200).json({ status: 'ready' });
  })
);

/**
 * GET /health/proxy
 * Tests proxy connectivity. Restricted to master role because the response
 * leaks exit IP, ASN, and endpoint metadata which would help an attacker
 * map our scraping infrastructure.
 */
router.get(
  '/proxy',
  authMiddleware,
  requirePermission('scraping:trigger'),
  asyncHandler(async (_req: Request, res: Response) => {
    if (!proxyService.isEnabled) {
      res.status(200).json({
        status: 'disabled',
        message: 'Proxy is not enabled. Set DECODO_PROXY_ENABLED=true to activate.',
        config: proxyService.getConfigSummary(),
      });
      return;
    }

    const result = await proxyService.testConnection();

    res.status(result.ok ? 200 : 503).json({
      status: result.ok ? 'ok' : 'error',
      proxy: {
        ip: result.ip,
        country: result.country,
        city: result.city,
        asn: result.asn,
        latencyMs: result.latencyMs,
      },
      error: result.error,
      config: proxyService.getConfigSummary(),
    });
  })
);

export const healthRouter: Router = router;
