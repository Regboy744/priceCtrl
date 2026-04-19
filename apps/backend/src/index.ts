import { createApp } from './app.js';
import { initOrderingRegistry } from './features/ordering/ordering.registry.js';
import { scraperRegistry } from './features/scraping/scraping.registry.js';
import { scrapingScheduler } from './features/scraping/scraping.scheduler.js';
import { env } from './shared/config/env.js';
import { browserService } from './shared/services/browser.service.js';
import { createLogger } from './shared/services/logger.service.js';

const log = createLogger('Server');

/**
 * Main entry point for the RetailCtrl backend.
 */
async function main(): Promise<void> {
  log.info({ environment: env.nodeEnv, port: env.port }, 'RetailCtrl backend starting');

  // Initialize scraper registry (loads supplier IDs from database)
  // This must happen before creating the app since routes may access scrapers
  await scraperRegistry.initialize();
  // Initialize ordering registry (loads supplier IDs for order handlers)
  await initOrderingRegistry();

  // Create Express app
  const app = createApp();

  // Start the server
  const server = app.listen(env.port, () => {
    log.info(
      {
        url: `http://localhost:${env.port}`,
        routes: [
          'GET /health',
          'GET /health/live',
          'GET /health/ready',
          'GET /api/v1/scraping/status',
          'GET /api/v1/scraping/jobs',
          'POST /api/v1/scraping/trigger',
          'POST /api/v1/orders/submit',
          'GET /api/v1/orders/handlers',
        ],
      },
      'HTTP server listening'
    );
  });

  // Long timeout for order submission: a full basket can take 2–3 minutes
  // end-to-end across multiple supplier HTTP calls (`BaseHttpOrderHandler`
  // via `curl_chrome131`).
  server.timeout = 200_000; // 200s - max time for a single request
  server.keepAliveTimeout = 200_000; // 200s - keep-alive connections
  server.headersTimeout = 205_000; // Must be > keepAliveTimeout

  // Start the scraping scheduler
  if (env.isProd || process.env.ENABLE_SCHEDULER === 'true') {
    scrapingScheduler.start();
    log.info({ schedule: env.scraping.cronSchedule }, 'Scraping scheduler started');
  } else {
    log.info('Scraping scheduler disabled (set ENABLE_SCHEDULER=true to enable in dev)');
  }
  log.info('Server ready');

  // ============ Graceful Shutdown ============
  const shutdown = async (signal: string): Promise<void> => {
    log.info({ signal }, 'Starting graceful shutdown');

    // Stop accepting new connections
    server.close(async () => {
      log.info('HTTP server closed');

      // Stop the scheduler
      scrapingScheduler.stop();
      log.info('Scheduler stopped');

      // Close browser
      await browserService.closeBrowser();
      log.info('Browser closed');

      log.info('Graceful shutdown complete');
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      log.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    log.error({ err: error }, 'Uncaught exception');
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    log.error({ promise, reason }, 'Unhandled rejection');
  });
}

// Run
main().catch((error) => {
  log.error({ err: error }, 'Failed to start server');
  process.exit(1);
});
