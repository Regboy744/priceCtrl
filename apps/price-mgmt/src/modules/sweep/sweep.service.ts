import fs from 'node:fs';
import path from 'node:path';
import type { BrowserContext as PlaywrightBrowserContext, Page } from 'playwright-core';
import { DEFAULT_REPORT_URL } from '../../../config/report.js';
import { sweepFields } from '../../../config/sweep.js';
import type { AppEnvironment } from '../../config/env.js';
import { resolveJobFile } from '../../config/paths.js';
import { runAutomatedLogin } from '../../auth.js';
import { attachNetworkCapture, blockUnnecessaryResources, launchBrowser } from '../../browser.js';
import { getSelectOptions, waitForDropdownEnabled } from '../../dom.js';
import type { SsrsPersistenceService } from '../../integrations/supabase/ssrs-persistence.service.js';
import { writeJson } from '../../output.js';
import { waitForReportSurface } from '../../report.js';
import { createProductsCsvAppender } from '../../scrape/output.js';
import { runParallelSweep } from '../../scrape/parallel.js';
import { runCascadedSweep } from '../../scrape/sweep.js';
import type {
  ProductBatchHandler,
  ScrapeAllOptions,
  SweepLimits,
  SweepOption,
} from '../../scrape/types.js';
import type { CaptureOptions, CaptureStats } from '../../types.js';
import { ValidationError } from '../../shared/errors/app-error.js';
import type { JobRunnerContext } from '../jobs/job.types.js';
import type { SweepJobRequest, SweepJobResult } from './sweep.types.js';

interface MemoryTelemetryControl {
  stop: () => Promise<void>;
}

type SweepExecutionStatus = 'completed' | 'failed';

interface SupabasePersistenceState {
  companyId: string | null;
  runId: string | null;
  rawRowsInserted: number;
  currentRowsMerged: number;
  unmatchedStoreNumbers: Set<string>;
}

function formatMb(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

function startMemoryTelemetry(input: {
  label: string;
  browser: Pick<PlaywrightBrowserContext, 'pages'>;
  logPath: string;
  getCaptureStats?: () => CaptureStats;
  logger: JobRunnerContext['logger'];
}): MemoryTelemetryControl {
  const intervalMs = 30_000;
  let stopped = false;

  fs.mkdirSync(path.dirname(input.logPath), { recursive: true });

  const writeLine = (line: string): void => {
    fs.appendFileSync(input.logPath, `${line}\n`, 'utf8');
  };

  const logSnapshot = async (stage: 'tick' | 'stop'): Promise<void> => {
    if (stopped && stage !== 'stop') {
      return;
    }

    const memory = process.memoryUsage();
    const pageCount = (() => {
      try {
        return input.browser.pages().length;
      } catch {
        return 0;
      }
    })();
    const captureStats = input.getCaptureStats ? input.getCaptureStats() : null;

    const base =
      `[memory:${input.label}] stage=${stage} rss=${formatMb(memory.rss)}MB ` +
      `heap=${formatMb(memory.heapUsed)}MB ext=${formatMb(memory.external)}MB pages=${pageCount}`;

    if (!captureStats) {
      writeLine(base);
      return;
    }

    const maxBytesText =
      captureStats.maxBytes === Number.MAX_SAFE_INTEGER
        ? 'unbounded'
        : `${formatMb(captureStats.maxBytes)}MB`;

    writeLine(
      `${base} captures=${captureStats.retainedCount}/${captureStats.maxItems} ` +
        `captureBytes=${formatMb(captureStats.retainedBytes)}MB capLimit=${maxBytesText} ` +
        `captureDropped=${captureStats.droppedCount}`
    );
  };

  void logSnapshot('tick');

  const timer = setInterval(() => {
    void logSnapshot('tick');
  }, intervalMs);

  return {
    stop: async (): Promise<void> => {
      if (stopped) {
        return;
      }

      stopped = true;
      clearInterval(timer);
      await logSnapshot('stop');
    },
  };
}

function resolveUserDataDir(
  inputPath: string | undefined,
  defaultPath: string,
  jobDirectory: string
): string {
  if (inputPath) {
    return path.resolve(inputPath);
  }

  const defaultBase = path.basename(defaultPath);
  return path.join(jobDirectory, defaultBase || 'browser-profile');
}

function toSweepOptions(options: Array<{ value: string; text: string }>): SweepOption[] {
  return options
    .filter((option) => option.value.trim().length > 0)
    .map((option) => ({
      value: option.value,
      text: option.text,
    }));
}

export class SweepService {
  constructor(
    private readonly env: AppEnvironment,
    private readonly ssrsPersistence: SsrsPersistenceService | null = null
  ) {}

  async execute(input: SweepJobRequest, context: JobRunnerContext): Promise<SweepJobResult> {
    const options = this.buildOptions(input, context.jobDirectory);
    this.validateOptions(options);

    return options.parallel
      ? this.runParallelJob(input, options, context)
      : this.runSequentialJob(input, options, context);
  }

  private async runSequentialJob(
    input: SweepJobRequest,
    options: ScrapeAllOptions,
    context: JobRunnerContext
  ): Promise<SweepJobResult> {
    const captureOptions = this.toCaptureOptions(options);
    const limits = this.toLimits(options);
    const outputCsvPath = resolveJobFile(context.jobDirectory, input.outputFileName, 'products.csv');
    const errorLogPath = path.join(context.jobDirectory, 'scrape-all-errors.log');
    const memoryLogPath = path.join(context.jobDirectory, 'memory-metrics.log');
    const summaryPath = path.join(context.jobDirectory, 'sweep-summary.json');

    fs.rmSync(errorLogPath, { force: true });
    fs.mkdirSync(path.dirname(errorLogPath), { recursive: true });

    const persistenceState = await this.initializeSupabasePersistence(input, context, 'sequential');
    const onProductBatch = this.buildSupabaseBatchHandler(persistenceState, context);
    let finalStatus: SweepExecutionStatus = 'failed';

    context.logger.info('Starting sequential sweep job', {
      outputCsvPath,
      reportUrl: captureOptions.reportUrl,
      requestDelayMs: options.requestDelayMs,
      sweepDepth: options.sweepDepth,
      limits,
      requestedStores: input.stores ?? null,
    });

    const browser = await launchBrowser(captureOptions);
    const csvAppender = createProductsCsvAppender(outputCsvPath);
    let captureContext: ReturnType<typeof attachNetworkCapture> | null = null;
    let memoryTelemetry: MemoryTelemetryControl | null = null;

    try {
      const page = await browser.newPage();
      await blockUnnecessaryResources(page);
      await page.bringToFront().catch(() => null);

      captureContext = attachNetworkCapture(page);
      const { captures, getCaptureCount, clearCaptures, getCaptureStats } = captureContext;

      memoryTelemetry = startMemoryTelemetry({
        label: 'sequential',
        browser,
        logPath: memoryLogPath,
        getCaptureStats,
        logger: context.logger,
      });

      await page.goto(captureOptions.reportUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 120_000,
      });

      if (captureOptions.autoLogin) {
        await runAutomatedLogin(page, captureOptions);
      }

      const reportSurface = await waitForReportSurface(page, captureOptions.timeoutMs);
      if (!reportSurface) {
        throw new ValidationError(
          'Could not detect the report surface. Sweep API jobs require autoLogin or a reusable authenticated browser profile with freshProfile=false.'
        );
      }

      const storeCandidates = await this.resolveRequestedStores(page, input.stores, context);
      const sweepLimits = storeCandidates ? { ...limits, maxStores: null } : limits;

      if (storeCandidates && limits.maxStores !== null) {
        context.logger.info('Ignoring maxStores because explicit stores were requested', {
          maxStores: limits.maxStores,
          requestedStores: input.stores,
        });
      }

      const stats = await runCascadedSweep({
        page,
        captures,
        getCaptureCount,
        clearCaptures,
        getCaptureStats,
        captureOptions,
        requestDelayMs: Math.max(0, options.requestDelayMs),
        sweepDepth: options.sweepDepth,
        limits: sweepLimits,
        csvAppender,
        onProductBatch,
        errorLogPath,
        ghostFamilyLogPath: path.join(context.jobDirectory, 'ghost-family.log'),
        storeCandidates,
      });

      const baseResult: SweepJobResult = {
        mode: 'sequential',
        stats,
        outputCsvPath,
        errorLogPath,
        memoryLogPath,
      };

      const result = this.withSupabaseMetadata(baseResult, persistenceState);

      writeJson(summaryPath, result);
      context.logger.info('Sequential sweep completed', {
        rowsWritten: stats.rowsWritten,
        combinationsScraped: stats.combinationsScraped,
        supabaseRunId: persistenceState.runId,
        rawRowsInserted: persistenceState.rawRowsInserted,
        currentRowsMerged: persistenceState.currentRowsMerged,
        unmatchedStoreCount: persistenceState.unmatchedStoreNumbers.size,
      });

      finalStatus = 'completed';
      return result;
    } finally {
      await this.finalizeSupabasePersistence(persistenceState, finalStatus, context, 'sequential');

      if (memoryTelemetry) {
        await memoryTelemetry.stop();
      }
      if (captureContext) {
        captureContext.detachCapture();
        captureContext.clearCaptures();
      }
      await csvAppender.close();
      await browser.close();
    }
  }

  private async runParallelJob(
    input: SweepJobRequest,
    options: ScrapeAllOptions,
    context: JobRunnerContext,
  ): Promise<SweepJobResult> {
    const captureOptions = this.toCaptureOptions(options);
    const limits = this.toLimits(options);
    const outputDirectory = path.join(context.jobDirectory, 'stores');
    const workerProfileBaseDir = path.join(context.jobDirectory, 'browser-profiles');
    const errorLogPath = path.join(context.jobDirectory, 'scrape-all-errors.log');
    const memoryLogPath = path.join(context.jobDirectory, 'memory-metrics.log');
    const summaryPath = path.join(context.jobDirectory, 'sweep-summary.json');

    fs.rmSync(errorLogPath, { force: true });
    fs.mkdirSync(path.dirname(errorLogPath), { recursive: true });

    const persistenceState = await this.initializeSupabasePersistence(input, context, 'parallel');
    const onProductBatch = this.buildSupabaseBatchHandler(persistenceState, context);
    let finalStatus: SweepExecutionStatus = 'failed';

    context.logger.info('Starting parallel sweep job', {
      outputDirectory,
      reportUrl: captureOptions.reportUrl,
      requestDelayMs: options.requestDelayMs,
      sweepDepth: options.sweepDepth,
      limits,
      maxParallelWorkers: options.maxParallelBrowsers,
      requestedStores: input.stores ?? null,
    });

    // Launch a lightweight "discovery" browser to resolve store candidates.
    // This browser is closed before isolated workers are launched.
    const discoveryBrowser = await launchBrowser(captureOptions);
    let memoryTelemetry: MemoryTelemetryControl | null = null;

    try {
      memoryTelemetry = startMemoryTelemetry({
        label: 'parallel-discovery',
        browser: discoveryBrowser,
        logPath: memoryLogPath,
        logger: context.logger,
      });

      const discoveryPage = await discoveryBrowser.newPage();
      await blockUnnecessaryResources(discoveryPage);
      await discoveryPage.bringToFront().catch(() => null);

      await discoveryPage.goto(captureOptions.reportUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 120_000,
      });

      if (captureOptions.autoLogin) {
        await runAutomatedLogin(discoveryPage, captureOptions);
      }

      const reportSurface = await waitForReportSurface(discoveryPage, captureOptions.timeoutMs);
      if (!reportSurface) {
        throw new ValidationError(
          'Could not detect the report surface. Sweep API jobs require autoLogin or a reusable authenticated browser profile with freshProfile=false.',
        );
      }

      const storeCandidates = await this.resolveRequestedStores(discoveryPage, input.stores, context);
      const sweepLimits = storeCandidates ? { ...limits, maxStores: null } : limits;

      if (storeCandidates && limits.maxStores !== null) {
        context.logger.info('Ignoring maxStores because explicit stores were requested', {
          maxStores: limits.maxStores,
          requestedStores: input.stores,
        });
      }

      // runParallelSweep will use discoveryPage for store discovery (if
      // storeCandidates is undefined), then close the discovery page before
      // launching isolated workers.  The discovery browser itself is closed
      // in the finally block below.
      const sweepResult = await runParallelSweep({
        discoveryBrowser,
        discoveryPage,
        captureOptions,
        requestDelayMs: Math.max(0, options.requestDelayMs),
        sweepDepth: options.sweepDepth,
        limits: sweepLimits,
        maxParallelWorkers: options.maxParallelBrowsers,
        outputDir: outputDirectory,
        workerProfileBaseDir,
        errorLogPath,
        storeCandidates,
        onProductBatch,
      });

      const baseResult: SweepJobResult = {
        mode: 'parallel',
        stats: sweepResult.aggregatedStats,
        outputDirectory,
        errorLogPath,
        memoryLogPath,
        storeResults: sweepResult.storeResults,
      };

      const result = this.withSupabaseMetadata(baseResult, persistenceState);

      writeJson(summaryPath, result);
      context.logger.info('Parallel sweep completed', {
        rowsWritten: sweepResult.aggregatedStats.rowsWritten,
        storesProcessed: sweepResult.aggregatedStats.storesProcessed,
        supabaseRunId: persistenceState.runId,
        rawRowsInserted: persistenceState.rawRowsInserted,
        currentRowsMerged: persistenceState.currentRowsMerged,
        unmatchedStoreCount: persistenceState.unmatchedStoreNumbers.size,
      });

      finalStatus = 'completed';
      return result;
    } finally {
      await this.finalizeSupabasePersistence(persistenceState, finalStatus, context, 'parallel');

      if (memoryTelemetry) {
        await memoryTelemetry.stop();
      }
      // Best-effort close in case discovery browser wasn't closed above
      // (e.g. error thrown before the explicit close).
      await discoveryBrowser.close().catch(() => null);
    }
  }

  private normalizeCompanyId(companyId: string | undefined): string | null {
    const normalized = String(companyId || '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private async initializeSupabasePersistence(
    input: SweepJobRequest,
    context: JobRunnerContext,
    mode: SweepJobResult['mode']
  ): Promise<SupabasePersistenceState> {
    const state: SupabasePersistenceState = {
      companyId: this.normalizeCompanyId(input.companyId),
      runId: null,
      rawRowsInserted: 0,
      currentRowsMerged: 0,
      unmatchedStoreNumbers: new Set<string>(),
    };

    if (!this.ssrsPersistence) {
      if (state.companyId) {
        context.logger.warn(
          'Supabase persistence is disabled because SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.'
        );
      }
      return state;
    }

    if (!state.companyId) {
      context.logger.warn('Supabase persistence skipped: companyId is missing from scrape request body.');
      return state;
    }

    try {
      state.runId = await this.ssrsPersistence.createRun({
        companyId: state.companyId,
        sourceJobId: context.jobId,
      });

      context.logger.info('Supabase scrape run created.', {
        mode,
        companyId: state.companyId,
        supabaseRunId: state.runId,
      });
    } catch (error) {
      context.logger.warn(
        'Failed to create Supabase scrape run. Continuing in CSV-only mode for this job.',
        {
          mode,
          companyId: state.companyId,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }

    return state;
  }

  private buildSupabaseBatchHandler(
    state: SupabasePersistenceState,
    context: JobRunnerContext
  ): ProductBatchHandler | undefined {
    const companyId = state.companyId;
    const runId = state.runId;

    if (!this.ssrsPersistence || !companyId || !runId) {
      return undefined;
    }

    const persistence = this.ssrsPersistence;

    return async (payload): Promise<void> => {
      try {
        const insertResult = await persistence.insertRawBatch({
          companyId,
          runId,
          storeValue: payload.storeValue,
          storeText: payload.storeText,
          pageNumber: payload.pageNumber,
          rows: payload.rows,
        });

        state.rawRowsInserted += insertResult.rowsInserted;

        if (insertResult.unmatchedStoreNumber) {
          const before = state.unmatchedStoreNumbers.size;
          state.unmatchedStoreNumbers.add(insertResult.unmatchedStoreNumber);

          if (state.unmatchedStoreNumbers.size > before) {
            context.logger.warn(
              'Store has no location_number match. Persisting SSRS rows with null location_id.',
              {
                companyId,
                storeNumber: insertResult.unmatchedStoreNumber,
              }
            );
          }
        }
      } catch (error) {
        context.logger.warn(
          'Supabase raw batch insert failed. Continuing sweep and keeping CSV output intact.',
          {
            companyId,
            supabaseRunId: runId,
            storeValue: payload.storeValue,
            storeText: payload.storeText,
            pageNumber: payload.pageNumber,
            error: error instanceof Error ? error.message : String(error),
          }
        );
      }
    };
  }

  private async finalizeSupabasePersistence(
    state: SupabasePersistenceState,
    status: SweepExecutionStatus,
    context: JobRunnerContext,
    mode: SweepJobResult['mode']
  ): Promise<void> {
    if (!this.ssrsPersistence || !state.runId) {
      return;
    }

    // Merge raw rows into current products table (only on success)
    if (status === 'completed' && state.rawRowsInserted > 0) {
      try {
        state.currentRowsMerged = await this.ssrsPersistence.mergeRunToCurrent(state.runId);

        context.logger.info('Supabase raw rows merged into current products.', {
          mode,
          supabaseRunId: state.runId,
          rawRowsInserted: state.rawRowsInserted,
          currentRowsMerged: state.currentRowsMerged,
        });
      } catch (error) {
        context.logger.warn('Failed to merge SSRS raw rows into current products.', {
          mode,
          supabaseRunId: state.runId,
          rawRowsInserted: state.rawRowsInserted,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    try {
      await this.ssrsPersistence.finalizeRun({
        runId: state.runId,
        status,
        rawRowsInserted: state.rawRowsInserted,
        currentRowsMerged: state.currentRowsMerged,
      });

      context.logger.info('Supabase scrape run finalized.', {
        mode,
        status,
        supabaseRunId: state.runId,
        rawRowsInserted: state.rawRowsInserted,
        currentRowsMerged: state.currentRowsMerged,
        unmatchedStoreCount: state.unmatchedStoreNumbers.size,
      });
    } catch (error) {
      context.logger.warn('Failed to finalize Supabase scrape run.', {
        mode,
        status,
        supabaseRunId: state.runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private withSupabaseMetadata(
    result: SweepJobResult,
    state: SupabasePersistenceState
  ): SweepJobResult {
    if (!state.runId) {
      return result;
    }

    return {
      ...result,
      supabaseRunId: state.runId,
      rawRowsInserted: state.rawRowsInserted,
      currentRowsMerged: state.currentRowsMerged,
      unmatchedStoreCount: state.unmatchedStoreNumbers.size,
    };
  }

  private buildOptions(input: SweepJobRequest, jobDirectory: string): ScrapeAllOptions {
    return {
      reportUrl: input.reportUrl || this.env.sweepDefaults.reportUrl || DEFAULT_REPORT_URL,
      outputCsvFile: resolveJobFile(jobDirectory, input.outputFileName, 'products.csv'),
      chromePath: input.chromePath || this.env.browser.chromePath,
      userDataDir: resolveUserDataDir(
        input.userDataDir,
        this.env.storage.defaultUserDataDir,
        jobDirectory
      ),
      headless: input.headless ?? this.env.sweepDefaults.headless,
      timeoutMs: input.timeoutMs ?? this.env.sweepDefaults.timeoutMs,
      autoLogin: input.autoLogin ?? this.env.auth.autoLogin,
      username: input.username ?? this.env.auth.username,
      password: input.password ?? this.env.auth.password,
      keepSignedIn: input.keepSignedIn ?? this.env.auth.keepSignedIn,
      selectDelayMs: input.selectDelayMs ?? this.env.sweepDefaults.selectDelayMs,
      browserActionTimeoutMs:
        input.browserActionTimeoutMs ?? this.env.sweepDefaults.browserActionTimeoutMs,
      selectPostbackTimeoutMs:
        input.selectPostbackTimeoutMs ?? this.env.sweepDefaults.selectPostbackTimeoutMs,
      freshProfile: input.freshProfile ?? this.env.sweepDefaults.freshProfile,
      renderTimeoutMs: input.renderTimeoutMs ?? this.env.sweepDefaults.renderTimeoutMs,
      postRenderCaptureWaitMs:
        input.postRenderCaptureWaitMs ?? this.env.sweepDefaults.postRenderCaptureWaitMs,
      preferredCaptureTimeoutMs:
        input.preferredCaptureTimeoutMs ?? this.env.sweepDefaults.preferredCaptureTimeoutMs,
      forcedAsyncRetries: input.forcedAsyncRetries ?? this.env.sweepDefaults.forcedAsyncRetries,
      requestDelayMs: input.requestDelayMs ?? this.env.sweepDefaults.requestDelayMs,
      sweepDepth: this.env.sweepDefaults.sweepDepth,
      maxStores: input.maxStores ?? null,
      maxDepartments: input.maxDepartments ?? null,
      maxSubdepartments: input.maxSubdepartments ?? null,
      maxCommodities: input.maxCommodities ?? null,
      maxFamilies: input.maxFamilies ?? null,
      parallel: input.parallel ?? this.env.sweepDefaults.parallel,
      maxParallelBrowsers: input.maxParallelBrowsers ?? this.env.sweepDefaults.maxParallelBrowsers,
    };
  }

  private toCaptureOptions(options: ScrapeAllOptions): CaptureOptions {
    return {
      reportUrl: options.reportUrl,
      sessionFile: path.join(path.dirname(options.outputCsvFile), 'session.ts'),
      chromePath: options.chromePath,
      userDataDir: options.userDataDir,
      headless: options.headless,
      timeoutMs: options.timeoutMs,
      autoLogin: options.autoLogin,
      username: options.username,
      password: options.password,
      keepSignedIn: options.keepSignedIn,
      applySelects: false,
      selectDelayMs: options.selectDelayMs,
      browserActionTimeoutMs: options.browserActionTimeoutMs,
      selectPostbackTimeoutMs: options.selectPostbackTimeoutMs,
      freshProfile: options.freshProfile,
      renderTimeoutMs: options.renderTimeoutMs,
      postRenderCaptureWaitMs: options.postRenderCaptureWaitMs,
      preferredCaptureTimeoutMs: options.preferredCaptureTimeoutMs,
      forcedAsyncRetries: options.forcedAsyncRetries,
    };
  }

  private toLimits(options: ScrapeAllOptions): SweepLimits {
    return {
      maxStores: options.maxStores,
      maxDepartments: options.maxDepartments,
      maxSubdepartments: options.maxSubdepartments,
      maxCommodities: options.maxCommodities,
      maxFamilies: options.maxFamilies,
    };
  }

  private async resolveRequestedStores(
    page: Page,
    requestedStores: string[] | undefined,
    context: JobRunnerContext
  ): Promise<SweepOption[] | undefined> {
    if (!requestedStores?.length) {
      return undefined;
    }

    const enabled = await waitForDropdownEnabled(page, sweepFields.store.selector, 45_000);
    if (!enabled) {
      throw new ValidationError('Store dropdown stayed disabled while resolving the requested store filter.');
    }

    const availableStores = toSweepOptions(await getSelectOptions(page, sweepFields.store.selector));
    if (!availableStores.length) {
      throw new ValidationError('Store dropdown has no selectable options.');
    }

    const storesByValue = new Map(availableStores.map((store) => [store.value, store]));
    const matchedStores: SweepOption[] = [];
    const missingStores: string[] = [];

    for (const requestedStore of requestedStores) {
      const matchedStore = storesByValue.get(requestedStore);
      if (matchedStore) {
        matchedStores.push(matchedStore);
        continue;
      }

      missingStores.push(requestedStore);
    }

    if (missingStores.length) {
      context.logger.warn('Some requested stores were not available in the SSRS dropdown', {
        requestedStores,
        missingStores,
        availableStoreCount: availableStores.length,
      });
    }

    if (!matchedStores.length) {
      throw new ValidationError(
        `None of the requested stores were found in the SSRS dropdown: ${requestedStores.join(', ')}`
      );
    }

    context.logger.info('Resolved requested store filter', {
      requestedStores,
      matchedStores: matchedStores.map((store) => ({
        value: store.value,
        text: store.text,
      })),
    });

    return matchedStores;
  }

  private validateOptions(options: ScrapeAllOptions): void {
    if (options.autoLogin && (!options.username || !options.password)) {
      throw new ValidationError(
        'Sweep autoLogin requires username and password, either in the request body or environment variables.'
      );
    }

    if (!options.autoLogin && options.freshProfile) {
      throw new ValidationError(
        'Sweep jobs require autoLogin or a reusable authenticated browser profile with freshProfile=false.'
      );
    }

    if (options.headless && !options.autoLogin && options.freshProfile) {
      throw new ValidationError(
        'Headless sweep jobs require autoLogin or a reusable authenticated browser profile.'
      );
    }
  }
}
