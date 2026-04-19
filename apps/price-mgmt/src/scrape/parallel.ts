import fs from 'node:fs';
import path from 'node:path';
import type { BrowserContext, Page } from 'playwright-core';
import { sweepFields } from '../../config/sweep.js';
import type { SweepDepth } from '../../config/sweep.js';
import { attachNetworkCapture, blockUnnecessaryResources, launchWorkerBrowser } from '../browser.js';
import { runAutomatedLogin } from '../auth.js';
import { getSelectOptions, waitForDropdownEnabled } from '../dom.js';
import { waitForReportSurface } from '../report.js';
import { logDebug, logError, logInfo, logWarn } from '../runtime-log.js';
import type { CaptureOptions } from '../types.js';
import {
  isAbortError,
  OperationAbortedError,
  resolveBrowserActionTimeoutMs,
  sleep,
  sleepWithAbort,
  throwIfAborted,
  toAbortError,
} from '../utils.js';
import { createProductsCsvAppender, sanitizeStoreName } from './output.js';
import { runCascadedSweep, SweepResumeRequiredError } from './sweep.js';
import type {
  ProductBatchHandler,
  ParallelStoreResult,
  SweepLimits,
  SweepOption,
  SweepResumeCursor,
  SweepStats,
} from './types.js';

export interface ParallelSweepInput {
  /** Browser used only for store discovery; closed before workers launch. */
  discoveryBrowser: BrowserContext;
  discoveryPage: Page;
  captureOptions: CaptureOptions;
  requestDelayMs: number;
  sweepDepth: SweepDepth;
  limits: SweepLimits;
  storeCandidates?: SweepOption[];
  maxParallelWorkers: number | null;
  outputDir: string;
  /** Base directory for per-worker browser profiles. */
  workerProfileBaseDir: string;
  errorLogPath: string;
  onProductBatch?: ProductBatchHandler;
}

interface ParallelSweepResult {
  aggregatedStats: SweepStats;
  storeResults: ParallelStoreResult[];
}

function envNonNegativeInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw.trim() === '') {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function readStoreRetryCount(): number {
  return Math.max(0, envNonNegativeInteger('STORE_RETRY_COUNT', 1));
}

function readParallelBrowserStaggerMs(): number {
  return Math.max(0, envNonNegativeInteger('PARALLEL_BROWSER_STAGGER_MS', 300));
}

const PAGE_CLOSE_TIMEOUT_MS = 5_000;
const BROWSER_CLOSE_TIMEOUT_MS = 10_000;

function readStoreWallClockTimeoutMs(): number {
  return Math.max(0, envNonNegativeInteger('STORE_WALL_CLOCK_TIMEOUT_MS', 0));
}

function createEmptyStats(): SweepStats {
  return {
    storesProcessed: 0,
    combinationsVisited: 0,
    combinationsScraped: 0,
    combinationsFailed: 0,
    rowsWritten: 0,
    pageRequests: 0,
  };
}

function readMaxFreshTabResumes(): number {
  return Math.max(1, envNonNegativeInteger('MAX_FRESH_TAB_RESUMES_PER_STORE', 25));
}

function appendError(errorLogPath: string, message: string): void {
  fs.mkdirSync(path.dirname(errorLogPath), { recursive: true });
  fs.appendFileSync(errorLogPath, `[${new Date().toISOString()}] ${message}\n`, 'utf8');
}

function isRetriableStoreError(message: string): boolean {
  const normalized = String(message || '').toLowerCase();

  return [
    'timeout',
    'target page, context or browser has been closed',
    'execution context was destroyed',
    'frame was detached',
    'navigation failed',
    'net::',
    'protocol error',
    'connection closed',
    'econnreset',
    'etimedout',
    'socket hang up',
    'dropdown stayed disabled',
    'error state after view report',
    'report viewer returned error',
    'could not detect report surface',
  ].some((token) => normalized.includes(token));
}

function attachPageDiagnostics(
  page: Page,
  storeLabel: string,
  errorLogPath: string
): () => void {
  const onPageError = (error: Error): void => {
    const message = error?.message || String(error);
    const logLine = `${storeLabel}: pageerror: ${message}`;
    logError(logLine);
    appendError(errorLogPath, logLine);
  };

  const onCrash = (): void => {
    const logLine = `${storeLabel}: page crashed.`;
    logError(logLine);
    appendError(errorLogPath, logLine);
  };

  page.on('pageerror', onPageError);
  page.on('crash', onCrash);

  return (): void => {
    page.off('pageerror', onPageError);
    page.off('crash', onCrash);
  };
}

function toSweepOptions(
  options: Array<{ value: string; text: string }>
): SweepOption[] {
  return options
    .filter((option) => option.value.trim().length > 0)
    .map((option) => ({
      value: option.value,
      text: option.text,
    }));
}

async function discoverStores(
  page: Page,
  maxStores: number | null
): Promise<SweepOption[]> {
  const enabled = await waitForDropdownEnabled(
    page,
    sweepFields.store.selector,
    45_000
  );
  if (!enabled) {
    throw new Error('Store dropdown stayed disabled while discovering stores.');
  }

  const rawOptions = await getSelectOptions(page, sweepFields.store.selector);
  const stores = toSweepOptions(rawOptions);

  if (!stores.length) {
    throw new Error('Store dropdown has no selectable options.');
  }

  logInfo(`Discovered ${stores.length} stores.`);

  if (maxStores !== null && maxStores > 0) {
    const limited = stores.slice(0, maxStores);
    logInfo(`Limited to ${limited.length} stores (--max-stores ${maxStores}).`);
    return limited;
  }

  return stores;
}

function generateStoreCsvPath(outputDir: string, store: SweepOption): string {
  const safeName = sanitizeStoreName(store.text);
  return path.join(outputDir, `store-${safeName}.csv`);
}

function formatResumeCursor(cursor: SweepResumeCursor): string {
  const levels = [
    cursor.store.option.text,
    cursor.department?.option.text,
    cursor.subdepartment?.option.text,
    cursor.commodity?.option.text,
    cursor.family?.option.text,
  ].filter((value): value is string => Boolean(value && value.trim().length > 0));

  const target = cursor[cursor.skipLevel]?.option.text || '(unknown)';
  const action = cursor.resumeMode === 'retry-current'
    ? `retry ${cursor.skipLevel} ${target}`
    : `skip ${cursor.skipLevel} ${target}`;
  return `${levels.join(' > ')} | ${action}`;
}

/**
 * Build a stable identity key for a resume cursor so that processStore can
 * detect when the same item keeps failing with retry-current.
 */
function resumeCursorKey(cursor: SweepResumeCursor): string {
  const parts = [
    cursor.skipLevel,
    cursor.store.option.value,
    cursor.department?.option.value ?? '',
    cursor.subdepartment?.option.value ?? '',
    cursor.commodity?.option.value ?? '',
    cursor.family?.option.value ?? '',
  ];
  return parts.join('|');
}

function readMaxRetriesPerItem(): number {
  return Math.max(1, envNonNegativeInteger('MAX_RETRY_CURRENT_PER_ITEM', 3));
}


/**
 * Open a fresh page inside an existing BrowserContext, navigate to the
 * report URL, run login if needed (instant when cookies are still valid),
 * and wait for the report surface.  Returns the ready page.
 */
async function prepareWorkerPage(
  browser: BrowserContext,
  captureOptions: CaptureOptions,
  storeLabel: string,
  storeIndex: number,
  abortSignal?: AbortSignal,
  abortFallbackMessage?: string,
): Promise<Page> {
  const page = await browser.newPage();
  await blockUnnecessaryResources(page);
  if (abortSignal) throwIfAborted(abortSignal, abortFallbackMessage ?? `${storeLabel}: aborted.`);

  const actionTimeoutMs = resolveBrowserActionTimeoutMs(captureOptions);
  page.setDefaultTimeout(actionTimeoutMs);
  page.setDefaultNavigationTimeout(Math.max(60_000, captureOptions.timeoutMs));

  if (!captureOptions.headless && storeIndex === 0) {
    await page.bringToFront().catch(() => null);
  }

  logDebug(`${storeLabel}: navigating to report...`);
  await page.goto(captureOptions.reportUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  });

  // runAutomatedLogin already checks if the report surface is present
  // (cookies still valid) and returns instantly in that case.
  if (captureOptions.autoLogin) {
    logDebug(`${storeLabel}: performing independent login...`);
    await runAutomatedLogin(page, captureOptions);
  }

  const reportSurface = await waitForReportSurface(
    page,
    captureOptions.timeoutMs,
    actionTimeoutMs,
    abortSignal,
  );
  if (!reportSurface) {
    // Close the page we just created — the caller will decide what to do.
    await page.close().catch(() => null);
    throw new Error(`${storeLabel}: could not detect report surface.`);
  }

  return page;
}

/**
 * Tier 1 recovery: open a new tab in the same BrowserContext (reusing
 * cookies/session), close the broken old page, and return the fresh page.
 *
 * Returns the new page on success, or `null` if recovery failed.
 * On failure the old page is still closed (best-effort) but the
 * BrowserContext is left alive so the caller can decide to retry or
 * fall back to a full browser restart.
 */
async function tryNewTabRecovery(
  workerBrowser: BrowserContext,
  oldPage: Page | undefined,
  captureOptions: CaptureOptions,
  storeLabel: string,
  storeIndex: number,
  abortSignal?: AbortSignal,
  abortFallbackMessage?: string,
): Promise<Page | null> {
  logInfo(`${storeLabel}: attempting new-tab recovery (same session)...`);

  // Best-effort close the broken page to free its memory.
  if (oldPage) {
    await Promise.race([
      oldPage.close().catch(() => null),
      sleep(PAGE_CLOSE_TIMEOUT_MS),
    ]);
  }

  try {
    const newPage = await prepareWorkerPage(
      workerBrowser,
      captureOptions,
      storeLabel,
      storeIndex,
      abortSignal,
      abortFallbackMessage,
    );
    logInfo(`${storeLabel}: new-tab recovery succeeded.`);
    return newPage;
  } catch (error) {
    // Re-throw abort errors so they propagate correctly.
    if (abortSignal?.aborted || isAbortError(error)) {
      throw error;
    }

    const msg = error instanceof Error ? error.message : String(error);
    logWarn(`${storeLabel}: new-tab recovery failed: ${msg}`);
    return null;
  }
}

/**
 * Safely tear down page-level resources (diagnostics, capture) without
 * closing the browser.  Returns cleared references.
 */
function cleanupPageResources(
  detachDiagnostics: (() => void) | null,
  captureContext: ReturnType<typeof attachNetworkCapture> | null,
): { detachDiagnostics: null; captureContext: null } {
  if (detachDiagnostics) {
    detachDiagnostics();
  }
  if (captureContext) {
    captureContext.detachCapture();
    captureContext.clearCaptures();
  }
  return { detachDiagnostics: null, captureContext: null };
}

async function closeBrowserSafely(
  browser: BrowserContext | undefined,
  storeLabel: string,
): Promise<void> {
  if (!browser) return;
  logDebug(`${storeLabel}: closing worker browser...`);
  await Promise.race([
    browser.close().catch(() => null),
    sleep(BROWSER_CLOSE_TIMEOUT_MS),
  ]);
}

async function processStore(
  store: SweepOption,
  captureOptions: CaptureOptions,
  requestDelayMs: number,
  sweepDepth: SweepDepth,
  limits: SweepLimits,
  csvPath: string,
  workerProfileDir: string,
  errorLogPath: string,
  storeIndex: number,
  totalStores: number,
  startupDelayMs: number,
  onProductBatch?: ProductBatchHandler,
  abortSignal?: AbortSignal,
): Promise<ParallelStoreResult> {
  const prefix = `[worker-${storeIndex + 1}/${totalStores}]`;
  const storeLabel = `${prefix} ${store.text}`;
  const maxAttempts = 1 + readStoreRetryCount();
  const maxFreshTabResumes = readMaxFreshTabResumes();
  const abortFallbackMessage = `${storeLabel}: store execution aborted.`;

  let attempt = 1;
  let resumeCount = 0;
  let resumeAfter: SweepResumeCursor | null = null;
  let stats = createEmptyStats();
  const maxRetriesPerItem = readMaxRetriesPerItem();
  const retryCurrentCounts = new Map<string, number>();
  let csvAppender = createProductsCsvAppender(csvPath);

  // The browser and page now live across loop iterations so that
  // new-tab recovery can reuse the same BrowserContext (and its
  // cookies/session) without a full re-login.
  let workerBrowser: BrowserContext | undefined;
  let page: Page | undefined;
  let captureContext: ReturnType<typeof attachNetworkCapture> | null = null;
  let detachDiagnostics: (() => void) | null = null;

  const closeBrowserOnAbort = (): void => {
    if (!workerBrowser) return;
    logWarn(`${storeLabel}: abort received, closing worker browser...`);
    void workerBrowser.close().catch(() => null);
  };

  abortSignal?.addEventListener('abort', closeBrowserOnAbort, { once: true });

  try {
    while (attempt <= maxAttempts) {
      throwIfAborted(abortSignal, abortFallbackMessage);

      if (startupDelayMs > 0 && attempt === 1 && resumeCount === 0 && !resumeAfter) {
        await sleepWithAbort(startupDelayMs, abortSignal, abortFallbackMessage);
      }

      // --- Launch a new browser when we don't have one. ---
      // This happens on the first iteration and after a failed new-tab
      // recovery that forced a full browser restart.
      if (!workerBrowser) {
        const attemptProfileDir = path.join(
          workerProfileDir,
          `attempt-${attempt}-resume-${resumeCount}`,
        );

        const openLabel = resumeAfter
          ? `${storeLabel}: launching isolated browser (attempt ${attempt}/${maxAttempts}, resume ${resumeCount + 1}/${maxFreshTabResumes})...`
          : `${storeLabel}: launching isolated browser (attempt ${attempt}/${maxAttempts})...`;
        logDebug(openLabel);
        logDebug(`${storeLabel}: launching isolated browser (profile=${attemptProfileDir})`);

        workerBrowser = await launchWorkerBrowser(
          captureOptions.chromePath,
          attemptProfileDir,
          captureOptions.headless,
          storeLabel,
        );
        logDebug(`${storeLabel}: isolated browser launched.`);
        throwIfAborted(abortSignal, abortFallbackMessage);

        page = await prepareWorkerPage(
          workerBrowser,
          captureOptions,
          storeLabel,
          storeIndex,
          abortSignal,
          abortFallbackMessage,
        );
      }

      // At this point we always have a live browser + page (either
      // freshly launched or recovered via new-tab).

      detachDiagnostics = attachPageDiagnostics(page!, storeLabel, errorLogPath);
      captureContext = attachNetworkCapture(page!);
      const {
        captures,
        getCaptureCount,
        clearCaptures,
        getCaptureStats,
      } = captureContext;

      logDebug(
        `${storeLabel}: report surface ready, starting sweep${
          resumeAfter ? ` (${formatResumeCursor(resumeAfter)})` : ''
        }...`,
      );

      const sweepLimits: SweepLimits = {
        maxStores: 1,
        maxDepartments: limits.maxDepartments,
        maxSubdepartments: limits.maxSubdepartments,
        maxCommodities: limits.maxCommodities,
        maxFamilies: limits.maxFamilies,
      };

      try {
        await runCascadedSweep({
          page: page!,
          captures,
          getCaptureCount,
          clearCaptures,
          getCaptureStats,
          captureOptions,
          requestDelayMs,
          sweepDepth,
          limits: sweepLimits,
          csvAppender,
          onProductBatch,
          errorLogPath,
          ghostFamilyLogPath: path.join(path.dirname(errorLogPath), 'ghost-family.log'),
          storeCandidates: [store],
          logPrefix: prefix,
          stats,
          resumeAfter,
          throwOnFreeze: true,
          abortSignal,
        });

        // Sweep completed successfully for this store.
        const finalCaptureStats = getCaptureStats();

        logInfo(
          `${storeLabel}: completed. combinations=${stats.combinationsScraped}, rows=${stats.rowsWritten}, failed=${stats.combinationsFailed}, droppedCaptures=${finalCaptureStats.droppedCount}, resumes=${resumeCount}`,
        );

        return {
          storeName: store.text,
          storeValue: store.value,
          csvPath,
          stats,
        };
      } catch (error) {
        // --- Abort handling ---
        if (abortSignal?.aborted || isAbortError(error)) {
          const message = toAbortError(abortSignal?.reason ?? error, abortFallbackMessage).message;
          logError(`${storeLabel}: ABORTED — ${message}`);
          appendError(errorLogPath, `${storeLabel}: aborted: ${message}`);
          return {
            storeName: store.text,
            storeValue: store.value,
            csvPath,
            stats,
            error: message,
          };
        }

        // --- Resume-required: two-tier recovery ---
        if (error instanceof SweepResumeRequiredError) {
          resumeAfter = error.resumeAfter;
          resumeCount += 1;

          if (resumeCount > maxFreshTabResumes) {
            const message = `${storeLabel}: exceeded fresh-tab resumes (${maxFreshTabResumes}) — ${error.message}`;
            logError(message);
            appendError(errorLogPath, message);
            return {
              storeName: store.text,
              storeValue: store.value,
              csvPath,
              stats,
              error: message,
            };
          }

          // Track per-item retry counts and escalate to skip-next when
          // the same item keeps failing.
          if (resumeAfter.resumeMode === 'retry-current') {
            const key = resumeCursorKey(resumeAfter);
            const previousCount = retryCurrentCounts.get(key) ?? 0;
            const newCount = previousCount + 1;
            retryCurrentCounts.set(key, newCount);

            if (newCount > maxRetriesPerItem) {
              logWarn(
                `${storeLabel}: retry-current exhausted for ${formatResumeCursor(resumeAfter)} (${newCount}/${maxRetriesPerItem}), escalating to skip-next`,
              );
              resumeAfter = {
                ...resumeAfter,
                resumeMode: 'skip-next',
                reason: `Escalated from retry-current after ${newCount} attempts: ${resumeAfter.reason}`,
              };
            }
          }

          const modeLabel = resumeAfter.resumeMode === 'retry-current' ? 'retry current' : 'skip confirmed';

          // Clean up page-level resources before recovery.
          ({ detachDiagnostics, captureContext } = cleanupPageResources(detachDiagnostics, captureContext));

          // Tier 1: try opening a new tab in the same browser context.
          // This reuses cookies/session — no Azure AD re-login needed.
          if (workerBrowser) {
            const newPage = await tryNewTabRecovery(
              workerBrowser,
              page,
              captureOptions,
              storeLabel,
              storeIndex,
              abortSignal,
              abortFallbackMessage,
            );

            if (newPage) {
              page = newPage;
              const resumeMessage = `${storeLabel}: [${modeLabel}] new-tab recovery, resuming after ${formatResumeCursor(resumeAfter)} (${resumeCount}/${maxFreshTabResumes})`;
              logWarn(resumeMessage);
              appendError(errorLogPath, resumeMessage);
              await sleepWithAbort(1_000, abortSignal, abortFallbackMessage);
              continue;
            }
          }

          // Tier 2: new-tab recovery failed (or no browser).
          // Fall back to a full browser restart with re-login.
          await closeBrowserSafely(workerBrowser, storeLabel);
          workerBrowser = undefined;
          page = undefined;

          const resumeMessage = `${storeLabel}: [${modeLabel}] reopening fresh browser to resume after ${formatResumeCursor(resumeAfter)} (${resumeCount}/${maxFreshTabResumes})`;
          logWarn(resumeMessage);
          appendError(errorLogPath, resumeMessage);
          await sleepWithAbort(1_000, abortSignal, abortFallbackMessage);
          continue;
        }

        // --- Non-resume errors: full retry with fresh browser ---
        ({ detachDiagnostics, captureContext } = cleanupPageResources(detachDiagnostics, captureContext));
        await closeBrowserSafely(workerBrowser, storeLabel);
        workerBrowser = undefined;
        page = undefined;

        const message = error instanceof Error ? error.message : String(error);
        const retryable = attempt < maxAttempts && isRetriableStoreError(message);

        logError(`${storeLabel}: FAILED (attempt ${attempt}/${maxAttempts}) — ${message}`);
        appendError(
          errorLogPath,
          `${storeLabel}: attempt ${attempt}/${maxAttempts} failed: ${message}`,
        );

        if (retryable) {
          logWarn(`${storeLabel}: retrying with a fresh browser...`);
          await csvAppender.close().catch(() => null);
          fs.rmSync(csvPath, { force: true });
          csvAppender = createProductsCsvAppender(csvPath);
          stats = createEmptyStats();
          resumeAfter = null;
          resumeCount = 0;
          attempt += 1;
          await sleepWithAbort(1_000, abortSignal, abortFallbackMessage);
          continue;
        }

        return {
          storeName: store.text,
          storeValue: store.value,
          csvPath,
          stats,
          error: message,
        };
      }
    }

    return {
      storeName: store.text,
      storeValue: store.value,
      csvPath,
      stats,
      error: `${storeLabel}: exhausted retries without result.`,
    };
  } catch (error) {
    if (abortSignal?.aborted || isAbortError(error)) {
      const message = toAbortError(abortSignal?.reason ?? error, abortFallbackMessage).message;
      logError(`${storeLabel}: ABORTED — ${message}`);
      appendError(errorLogPath, `${storeLabel}: aborted: ${message}`);
      return {
        storeName: store.text,
        storeValue: store.value,
        csvPath,
        stats,
        error: message,
      };
    }

    throw error;
  } finally {
    abortSignal?.removeEventListener('abort', closeBrowserOnAbort);

    // Clean up any remaining page-level resources.
    cleanupPageResources(detachDiagnostics, captureContext);

    // Always close the browser when exiting processStore.
    await closeBrowserSafely(workerBrowser, storeLabel);

    await csvAppender.close().catch(() => null);
  }
}


function aggregateStats(results: ParallelStoreResult[]): SweepStats {
  const totals: SweepStats = {
    storesProcessed: 0,
    combinationsVisited: 0,
    combinationsScraped: 0,
    combinationsFailed: 0,
    rowsWritten: 0,
    pageRequests: 0,
  };

  for (const result of results) {
    totals.storesProcessed += result.stats.storesProcessed;
    totals.combinationsVisited += result.stats.combinationsVisited;
    totals.combinationsScraped += result.stats.combinationsScraped;
    totals.combinationsFailed += result.stats.combinationsFailed;
    totals.rowsWritten += result.stats.rowsWritten;
    totals.pageRequests += result.stats.pageRequests;
  }

  return totals;
}

async function processStoreWithWallClockTimeout(
  store: SweepOption,
  captureOptions: CaptureOptions,
  requestDelayMs: number,
  sweepDepth: SweepDepth,
  limits: SweepLimits,
  csvPath: string,
  workerProfileDir: string,
  errorLogPath: string,
  storeIndex: number,
  totalStores: number,
  startupDelayMs: number,
  onProductBatch: ProductBatchHandler | undefined,
  storeWallClockTimeoutMs: number,
): Promise<ParallelStoreResult> {
  if (storeWallClockTimeoutMs <= 0) {
    return processStore(
      store,
      captureOptions,
      requestDelayMs,
      sweepDepth,
      limits,
      csvPath,
      workerProfileDir,
      errorLogPath,
      storeIndex,
      totalStores,
      startupDelayMs,
      onProductBatch,
    );
  }

  const controller = new AbortController();
  const timeoutMessage = `Store ${store.text} exceeded wall-clock timeout of ${storeWallClockTimeoutMs}ms`;
  const timeoutHandle = setTimeout(() => {
    controller.abort(new OperationAbortedError(timeoutMessage));
  }, storeWallClockTimeoutMs);

  try {
    return await processStore(
      store,
      captureOptions,
      requestDelayMs,
      sweepDepth,
      limits,
      csvPath,
      workerProfileDir,
      errorLogPath,
      storeIndex,
      totalStores,
      startupDelayMs,
      onProductBatch,
      controller.signal,
    );
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function runParallelSweep(
  input: ParallelSweepInput,
): Promise<ParallelSweepResult> {
  // --- Phase 1: Discover stores using the shared discovery browser. ---
  const stores = input.storeCandidates
    ?? (await discoverStores(input.discoveryPage, input.limits.maxStores));

  if (input.storeCandidates) {
    logInfo(`Parallel sweep: assigned ${stores.length} requested stores.`);
  }

  // Close the discovery browser entirely to free resources before
  // launching isolated worker browsers.  Each worker will have its own
  // Chromium process with a separate profile directory.
  await input.discoveryPage.goto('about:blank').catch(() => null);
  await input.discoveryPage.close().catch(() => null);
  await input.discoveryBrowser.close().catch(() => null);
  logInfo('Discovery browser closed. Launching isolated worker browsers.');

  if (!stores.length) {
    return {
      aggregatedStats: {
        storesProcessed: 0,
        combinationsVisited: 0,
        combinationsScraped: 0,
        combinationsFailed: 0,
        rowsWritten: 0,
        pageRequests: 0,
      },
      storeResults: [],
    };
  }

  fs.mkdirSync(input.outputDir, { recursive: true });
  fs.mkdirSync(input.workerProfileBaseDir, { recursive: true });

  // --- Phase 2: Launch isolated browser workers in batches. ---
  const maxWorkers = input.maxParallelWorkers ?? stores.length;
  const effectiveWorkers = Math.min(Math.max(1, maxWorkers), stores.length);
  const staggerMs = readParallelBrowserStaggerMs();

  logInfo(
    `Parallel sweep: ${stores.length} stores, ${effectiveWorkers} concurrent workers (isolated browsers).`,
  );
  logDebug(`Parallel worker stagger: ${staggerMs}ms`);

  const allResults: ParallelStoreResult[] = [];

  for (let batchStart = 0; batchStart < stores.length; batchStart += effectiveWorkers) {
    const batch = stores.slice(batchStart, batchStart + effectiveWorkers);
    const batchNum = Math.floor(batchStart / effectiveWorkers) + 1;
    const totalBatches = Math.ceil(stores.length / effectiveWorkers);

    logInfo(
      `Batch ${batchNum}/${totalBatches}: processing ${batch.length} stores (${batch.map((s) => s.text).join(', ')})`,
    );

    const storeWallClockTimeoutMs = readStoreWallClockTimeoutMs();

    const batchPromises = batch.map((store, indexInBatch) => {
      const globalIndex = batchStart + indexInBatch;
      const csvPath = generateStoreCsvPath(input.outputDir, store);
      const workerProfileDir = path.join(
        input.workerProfileBaseDir,
        `worker-${globalIndex}-${sanitizeStoreName(store.text)}`,
      );

      return processStoreWithWallClockTimeout(
        store,
        input.captureOptions,
        input.requestDelayMs,
        input.sweepDepth,
        input.limits,
        csvPath,
        workerProfileDir,
        input.errorLogPath,
        globalIndex,
        stores.length,
        indexInBatch * staggerMs,
        input.onProductBatch,
        storeWallClockTimeoutMs,
      );
    });

    const batchResults = await Promise.allSettled(batchPromises);

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        allResults.push(result.value);
      } else {
        const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
        logError(`Unexpected batch failure: ${reason}`);
      }
    }

    logInfo(`Batch ${batchNum}/${totalBatches}: completed.`);
  }

  return {
    aggregatedStats: aggregateStats(allResults),
    storeResults: allResults,
  };
}
