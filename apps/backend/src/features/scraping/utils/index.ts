// Bezier curve utilities for mouse movement
export {
  generateBezierCurve,
  mouseMoveToElement,
  DEFAULT_BEZIER_CONFIG,
  type BezierConfig,
} from './bezier.js';

// Human-like behavior utilities
export {
  randomBetween,
  humanDelay,
  microMovements,
  clickElement,
  typeInElement,
  clearAndFillInput,
  waitForPageReady,
  DEFAULT_TYPING_CONFIG,
  DEFAULT_HUMAN_CONFIG,
  type TypingConfig,
  type HumanBehaviorConfig,
} from './human-behavior.js';

// Parallel scraping utilities
export {
  chunkArray,
  createAuthenticatedPage,
  mergeStats,
  createEmptyCategoryStats,
  createEmptyStreamingStats,
  createPagePool,
  closePagePool,
  type CategoryStats,
  type CategoryScrapeResult,
} from './parallel.js';
