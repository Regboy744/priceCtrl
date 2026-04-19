import cron from 'node-cron';
import { env } from '../../shared/config/env.js';
import { createLogger } from '../../shared/services/logger.service.js';
import { getAllScrapers } from './scraping.registry.js';
import { scrapingService } from './scraping.service.js';

const log = createLogger('Scheduler');

/**
 * Scheduler for automated scraping jobs.
 * Uses node-cron for simple, reliable scheduling.
 */
class ScrapingScheduler {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;

  /**
   * Start the scheduler with the configured cron schedule.
   */
  start(): void {
    if (this.cronJob) {
      log.warn('Already running');
      return;
    }

    const schedule = env.scraping.cronSchedule;

    if (!cron.validate(schedule)) {
      log.error({ schedule }, 'Invalid cron schedule');
      return;
    }

    this.cronJob = cron.schedule(schedule, async () => {
      await this.runScheduledScrape();
    });

    log.info({ schedule, nextRuns: this.getNextRuns(3) }, 'Scheduler started');
  }

  /**
   * Stop the scheduler.
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      log.info('Scheduler stopped');
    }
  }

  /**
   * Run a scheduled scrape for all suppliers.
   *
   * Suppliers run in PARALLEL (each gets its own browser).
   * Within each supplier the flow is SEQUENTIAL: baseline first, then delta companies one at a time.
   * This gives us the speed of trigger-all with the correctness of baseline-before-delta.
   */
  private async runScheduledScrape(): Promise<void> {
    if (this.isRunning) {
      log.warn('Previous run still in progress, skipping');
      return;
    }

    this.isRunning = true;
    log.info('Starting scheduled scrape');

    try {
      const scrapers = getAllScrapers();

      if (scrapers.length === 0) {
        log.warn('No registered scrapers found');
        return;
      }

      // Run every supplier chain in parallel — each chain is baseline → deltas (sequential)
      const results = await Promise.allSettled(
        scrapers.map((scraper) => this.runSupplierChain(scraper.supplierId, scraper.name))
      );

      // Aggregate results
      let totalJobs = 0;
      let completedJobs = 0;
      let failedJobs = 0;

      for (const result of results) {
        if (result.status === 'fulfilled') {
          totalJobs += result.value.total;
          completedJobs += result.value.completed;
          failedJobs += result.value.failed;
        } else {
          // The chain itself threw (unexpected)
          failedJobs++;
          totalJobs++;
          log.error({ err: result.reason }, 'Supplier chain rejected');
        }
      }

      log.info({ completedJobs, totalJobs, failedJobs }, 'Scheduled scrape finished');
    } catch (error) {
      log.error({ err: error }, 'Error in scheduled scrape');
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Run the full scrape chain for a single supplier: baseline first, then deltas.
   * Runs sequentially within the supplier to guarantee baseline data exists before deltas.
   * Multiple suppliers call this in parallel.
   */
  private async runSupplierChain(
    supplierId: string,
    scraperName: string
  ): Promise<{ total: number; completed: number; failed: number }> {
    let total = 0;
    let completed = 0;
    let failed = 0;

    try {
      const plan = await scrapingService.getSupplierScrapePlan(supplierId);

      if (!plan) {
        log.info({ scraperName, supplierId }, 'No eligible companies with credentials');
        return { total, completed, failed };
      }

      log.info(
        {
          scraperName,
          supplierId,
          baselineCompanyId: plan.baselineCompanyId,
          specialPricingCompanyCount: plan.specialPricingCompanyIds.length,
          forceBaseline: plan.forceBaseline,
        },
        'Supplier scrape plan ready'
      );

      // 1. Baseline first — must complete before deltas
      total++;
      try {
        log.info(
          {
            scraperName,
            supplierId,
            companyId: plan.baselineCompanyId,
            forceBaseline: plan.forceBaseline,
          },
          'Starting baseline scrape'
        );
        const baselineJob = await scrapingService.executeScrapeJob(
          {
            supplierId,
            companyId: plan.baselineCompanyId,
            isManual: false,
          },
          plan.forceBaseline
        );

        if (baselineJob.status === 'completed') {
          completed++;
          log.info(
            { scraperName, supplierId, companyId: plan.baselineCompanyId },
            'Baseline scrape completed'
          );
        } else {
          failed++;
          log.error(
            { scraperName, supplierId, companyId: plan.baselineCompanyId },
            'Baseline scrape failed, skipping delta scrapes'
          );
          return { total, completed, failed };
        }
      } catch (error) {
        failed++;
        log.error(
          { scraperName, supplierId, companyId: plan.baselineCompanyId, err: error },
          'Baseline scrape error, skipping delta scrapes'
        );
        return { total, completed, failed };
      }

      // 2. Delta scrapes — one company at a time, after baseline
      for (const companyId of plan.specialPricingCompanyIds) {
        total++;
        try {
          log.info({ scraperName, supplierId, companyId }, 'Starting delta scrape');
          const deltaJob = await scrapingService.executeScrapeJob(
            {
              supplierId,
              companyId,
              isManual: false,
            },
            false
          );

          if (deltaJob.status === 'completed') {
            completed++;
            log.info({ scraperName, supplierId, companyId }, 'Delta scrape completed');
          } else {
            failed++;
            log.error({ scraperName, supplierId, companyId }, 'Delta scrape failed');
          }
        } catch (error) {
          failed++;
          log.error({ scraperName, supplierId, companyId, err: error }, 'Delta scrape error');
        }
      }
    } catch (error) {
      log.error({ scraperName, supplierId, err: error }, 'Error building scrape plan');
    }

    return { total, completed, failed };
  }

  /**
   * Trigger a manual scrape (outside of schedule).
   */
  async triggerManualScrape(): Promise<void> {
    log.info('Manual scrape triggered');
    await this.runScheduledScrape();
  }

  /**
   * Get the next N scheduled run times.
   */
  getNextRuns(count = 5): string[] {
    const schedule = env.scraping.cronSchedule;
    const runs: string[] = [];

    // Simple calculation for common patterns
    // For production, you might want to use a library like cron-parser
    const now = new Date();

    // Parse the cron schedule to get hours (assuming format like "0 6,12,18 * * *")
    const parts = schedule.split(' ');
    if (parts.length >= 2) {
      const hours = parts[1].split(',').map(Number);

      for (let day = 0; day < 7 && runs.length < count; day++) {
        for (const hour of hours) {
          const runTime = new Date(now);
          runTime.setDate(runTime.getDate() + day);
          runTime.setHours(hour, 0, 0, 0);

          if (runTime > now && runs.length < count) {
            runs.push(runTime.toISOString());
          }
        }
      }
    }

    return runs;
  }

  /**
   * Check if the scheduler is running.
   */
  isSchedulerRunning(): boolean {
    return this.cronJob !== null;
  }

  /**
   * Check if a scrape is currently in progress.
   */
  isScrapeRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get scheduler status.
   */
  getStatus(): {
    isRunning: boolean;
    isScrapeInProgress: boolean;
    schedule: string;
    nextRuns: string[];
  } {
    return {
      isRunning: this.isSchedulerRunning(),
      isScrapeInProgress: this.isScrapeRunning(),
      schedule: env.scraping.cronSchedule,
      nextRuns: this.getNextRuns(3),
    };
  }
}

// Singleton instance
export const scrapingScheduler = new ScrapingScheduler();
