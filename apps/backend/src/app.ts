import compression from 'compression';
import cors from 'cors';
import express, { type Application } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { addressesRouter } from './features/addresses/addresses.controller.js';
import { brandsRouter } from './features/brands/brands.controller.js';
import { companiesRouter } from './features/companies/companies.controller.js';
import { companySettingsRouter } from './features/companySettings/companySettings.controller.js';
import { healthRouter } from './features/health/health.controller.js';
import { locationCredentialsRouter } from './features/locationCredentials/locationCredentials.controller.js';
import { locationsRouter } from './features/locations/locations.controller.js';
import { masterProductsRouter } from './features/masterProducts/masterProducts.controller.js';
import { meRouter } from './features/me/me.controller.js';
import { orderingRouter } from './features/ordering/ordering.controller.js';
import { priceCheckRouter } from './features/priceCheck/priceCheck.controller.js';
import { scrapingRouter } from './features/scraping/scraping.controller.js';
import { suppliersRouter } from './features/suppliers/suppliers.controller.js';
import { env } from './shared/config/env.js';
import { correlationMiddleware } from './shared/middleware/correlation.middleware.js';
import { errorMiddleware, notFoundMiddleware } from './shared/middleware/error.middleware.js';
import { globalLimiter } from './shared/middleware/rateLimit.middleware.js';
import { createLogger } from './shared/services/logger.service.js';

const log = createLogger('Http');

/**
 * Create and configure the Express application.
 */
export function createApp(): Application {
  const app = express();

  // ============ Request Context ============
  // Runs first so every downstream middleware, route handler, and
  // log line automatically carries a correlation id.
  app.use(correlationMiddleware);

  // ============ Security Middleware ============
  // helmet() defaults enable: contentSecurityPolicy (strict defaults — only
  // 'self' for script-src/style-src; no inline scripts), strict-transport-
  // security, x-content-type-options: nosniff, x-frame-options: SAMEORIGIN,
  // and a small set of cross-origin-* policies. This is a pure JSON API so
  // the CSP never applies to rendered pages; we keep it on because `/` and
  // `/health/*` still return HTML-ish fallbacks and a belt-and-braces CSP
  // costs nothing.
  app.use(helmet());
  app.use(compression());
  app.use(globalLimiter);

  // CORS configuration. Production origins come from ALLOWED_ORIGINS
  // (comma-separated) and are parsed once at startup in env.ts.
  app.use(
    cors({
      origin: env.isDev
        ? ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173']
        : env.allowedOrigins,
      credentials: true,
    })
  );

  // ============ Parsing Middleware ============
  // Default: 2mb. The 200mb ceiling required for the masterProducts
  // bulk-import path (~200k CSV rows) is applied as router-level middleware
  // on that endpoint only — see masterProducts.controller.ts.
  // A future refactor should stream the upload via multipart so memory stays
  // flat regardless of row count.
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // ============ Logging Middleware ============
  const morganStream = {
    write: (message: string) => {
      log.info({ access: message.trim() }, 'HTTP request');
    },
  };

  if (env.isDev) {
    app.use(morgan('dev', { stream: morganStream }));
  } else {
    app.use(morgan('combined', { stream: morganStream }));
  }

  // ============ Routes ============

  // Health check routes (no auth required)
  app.use('/health', healthRouter);

  // API v1 routes
  app.use('/api/v1/me', meRouter);
  app.use('/api/v1/addresses', addressesRouter);
  app.use('/api/v1/brands', brandsRouter);
  app.use('/api/v1/companies', companiesRouter);
  app.use('/api/v1/company-settings', companySettingsRouter);
  app.use('/api/v1/locations', locationsRouter);
  app.use('/api/v1/location-credentials', locationCredentialsRouter);
  app.use('/api/v1/master-products', masterProductsRouter);
  app.use('/api/v1/suppliers', suppliersRouter);
  app.use('/api/v1/scraping', scrapingRouter);
  app.use('/api/v1/price-check', priceCheckRouter);
  app.use('/api/v1/orders', orderingRouter);

  // Root route
  app.get('/', (_req, res) => {
    res.json({
      name: 'RetailCtrl Backend',
      version: '1.0.0',
      status: 'running',
      docs: '/health for health check',
    });
  });

  // ============ Error Handling ============
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
