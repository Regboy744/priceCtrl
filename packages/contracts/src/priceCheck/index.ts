/**
 * Price-check public surface.
 *
 * Everything consumers should touch is exported here. The inferred types
 * below are the canonical TypeScript representation of each schema —
 * consumers should import them instead of redefining types by hand.
 */

import type { z } from 'zod';
import {
  BestOverallSchema,
  ParseResultSchema,
  PriceCheckRequestItemSchema,
  PriceCheckRequestSchema,
  PriceCheckResponseSchema,
  PriceCheckSummarySchema,
  ProductComparisonSchema,
  ProductEvaluationSchema,
  ProductOrderInfoSchema,
  SummaryCountsSchema,
  SummaryEvaluationResultsSchema,
  SummaryOrderTotalsSchema,
  SupplierConstraintSchema,
  SupplierPriceSchema,
  SupplierRankingSchema,
  SupplierSchema,
  UploadAndCompareResponseSchema,
  ValidationWarningSchema,
} from './schemas.js';

export * from './schemas.js';

export type Supplier = z.infer<typeof SupplierSchema>;
export type SupplierPrice = z.infer<typeof SupplierPriceSchema>;
export type ProductEvaluation = z.infer<typeof ProductEvaluationSchema>;
export type ProductOrderInfo = z.infer<typeof ProductOrderInfoSchema>;
export type ProductComparison = z.infer<typeof ProductComparisonSchema>;
export type SupplierRanking = z.infer<typeof SupplierRankingSchema>;
export type SummaryCounts = z.infer<typeof SummaryCountsSchema>;
export type SummaryOrderTotals = z.infer<typeof SummaryOrderTotalsSchema>;
export type BestOverall = z.infer<typeof BestOverallSchema>;
export type SummaryEvaluationResults = z.infer<typeof SummaryEvaluationResultsSchema>;
export type PriceCheckSummary = z.infer<typeof PriceCheckSummarySchema>;
export type PriceCheckRequestItem = z.infer<typeof PriceCheckRequestItemSchema>;
export type PriceCheckRequest = z.infer<typeof PriceCheckRequestSchema>;
export type PriceCheckResponse = z.infer<typeof PriceCheckResponseSchema>;
export type ParseResult = z.infer<typeof ParseResultSchema>;
export type UploadAndCompareResponse = z.infer<typeof UploadAndCompareResponseSchema>;
export type SupplierConstraint = z.infer<typeof SupplierConstraintSchema>;
export type ValidationWarning = z.infer<typeof ValidationWarningSchema>;
