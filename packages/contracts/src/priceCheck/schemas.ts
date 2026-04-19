/**
 * Price-check contracts — Zod schemas that define the shapes crossing the
 * HTTP boundary between the backend and any consumer (frontend today,
 * future microservices later). Types are inferred — never hand-written
 * copies — so backend and frontend cannot disagree.
 *
 * Organization:
 *   - Common primitives (Supplier, SupplierPrice, ProductEvaluation)
 *   - Product (ProductComparison)
 *   - Summary (counts, order_totals, evaluation_results, supplier_rankings)
 *   - Request / response envelopes
 */

import { z } from 'zod';

// ─── Common primitives ───────────────────────────────────────────────────────

export const SupplierSchema = z.object({
  id: z.string(),
  name: z.string(),
  is_active: z.boolean(),
});

export const SupplierPriceSchema = z.object({
  unit_price: z.number(),
  catalog_price: z.number(),
  line_total: z.number(),
  difference_vs_order: z.number(),
  availability_status: z.string(),
  is_special_price: z.boolean(),
  special_price_notes: z.string().nullable(),
  valid_until: z.string().nullable(),
  supplier_product_code: z.string(),
  /** Supplier internal product ID (for ordering). Optional: older catalog rows may omit it. */
  internal_product_id: z.string().nullable().optional(),
  /** Per-consumer-unit cost (VAT incl). Null when scraper couldn't extract. */
  unit_cost_incl_vat: z.number().nullable(),
  /** Consumer units per pack (12, 24…). Null when unknown. */
  pack_count: z.number().int().nullable(),
  /** Raw pack-unit size string ("60gm", "1.25l"). Display only. */
  pack_unit_size: z.string().nullable(),
});

export const ProductEvaluationSchema = z.object({
  winning_supplier_id: z.string().nullable(),
  winning_supplier_name: z.string().nullable(),
  winning_price: z.number().nullable(),
  order_is_best: z.boolean(),
  best_price_source: z.enum(['order', 'supplier']).nullable(),
  potential_savings: z.number().nullable(),
  threshold_percentage: z.number(),
  required_price_to_win: z.number(),
  supplier_price_difference_pct: z.number(),
  threshold_met: z.boolean(),
});

// ─── Product ─────────────────────────────────────────────────────────────────

export const ProductOrderInfoSchema = z.object({
  quantity: z.number(),
  unit_cost: z.number(),
  line_cost: z.number(),
});

export const ProductComparisonSchema = z.object({
  product_id: z.string(),
  article_code: z.string(),
  description: z.string(),
  ean_code: z.string(),
  unit_size: z.string().nullable(),
  /** Set when ranking cannot safely auto-pick (ambiguous pack or missing unit cost). */
  requires_user_pick: z.boolean(),
  order: ProductOrderInfoSchema,
  /** supplier_id → array of price variants (sorted most-expensive first). */
  supplier_prices: z.record(z.string(), z.array(SupplierPriceSchema)),
  evaluation: ProductEvaluationSchema,
});

// ─── Summary ─────────────────────────────────────────────────────────────────

export const SupplierRankingSchema = z.object({
  supplier_id: z.string(),
  supplier_name: z.string(),
  products_won: z.number(),
  total_cost_if_all_from_here: z.number(),
  won_products_supplier_cost: z.number(),
  won_products_order_cost: z.number(),
  savings_on_won_products: z.number(),
  savings_percentage: z.number(),
});

export const SummaryCountsSchema = z.object({
  total_items_submitted: z.number(),
  products_found: z.number(),
  products_not_found: z.array(z.string()),
  /**
   * Article codes found in master_products but with no supplier_products row
   * (no supplier sells the item). Distinct from products_not_found, which
   * means the article is missing from the catalog entirely.
   */
  products_unpriced: z.array(z.string()),
  suppliers_compared: z.number(),
});

export const SummaryOrderTotalsSchema = z.object({
  total_order_value: z.number(),
  matched_order_value: z.number(),
});

export const BestOverallSchema = z.object({
  source: z.enum(['order', 'supplier']),
  supplier_id: z.string().nullable(),
  supplier_name: z.string().nullable(),
  total_cost: z.number(),
  savings_vs_order: z.number(),
});

export const SummaryEvaluationResultsSchema = z.object({
  products_order_is_best: z.number(),
  products_supplier_is_best: z.number(),
  products_below_threshold: z.number(),
  max_potential_savings: z.number().nullable(),
  recommendation: z.enum(['keep_order', 'switch_supplier', 'mixed']),
  best_overall: BestOverallSchema.nullable(),
});

export const PriceCheckSummarySchema = z.object({
  counts: SummaryCountsSchema,
  order_totals: SummaryOrderTotalsSchema,
  evaluation_results: SummaryEvaluationResultsSchema,
  supplier_rankings: z.array(SupplierRankingSchema),
  thresholds_applied: z.record(z.string(), z.number()),
});

// ─── Request / Response envelopes ────────────────────────────────────────────

export const PriceCheckRequestItemSchema = z.object({
  article_code: z.string().min(1, 'article_code is required'),
  quantity: z.number().positive('quantity must be positive'),
  unit_cost: z.number().positive('unit_cost must be positive'),
});

export const PriceCheckRequestSchema = z.object({
  company_id: z.uuid('company_id must be a valid UUID'),
  items: z.array(PriceCheckRequestItemSchema).min(1, 'At least one item is required'),
  supplier_ids: z.array(z.uuid()).optional(),
  include_unavailable: z.boolean().default(false),
});

/**
 * Declarative per-supplier ordering constraints. Backend derives these
 * from each supplier's order-handler config; the frontend uses them to
 * render pre-flight UX warnings ("this supplier needs an internal
 * product id"). New constraints are added here as rules appear.
 */
export const SupplierConstraintSchema = z.object({
  /** Supplier needs `internal_product_id` on every submitted item (Savage & Whitten). */
  requires_internal_product_id: z.boolean(),
  /** Max items the supplier's basket endpoint accepts in one request. */
  max_items_per_request: z.number().int().positive().optional(),
});

export const PriceCheckResponseSchema = z.object({
  data_category: z.literal('price_comparison'),
  description: z.string(),
  thresholds_used: z.record(
    z.string(),
    z.object({ supplier_name: z.string(), percentage: z.number() })
  ),
  suppliers: z.array(SupplierSchema),
  /** supplier_id → ordering-side constraints the UI should enforce. */
  supplier_constraints: z.record(z.string(), SupplierConstraintSchema),
  products: z.array(ProductComparisonSchema),
  summary: PriceCheckSummarySchema,
});

export const ParseResultSchema = z.object({
  data_category: z.literal('order_input'),
  description: z.string(),
  success: z.boolean(),
  items: z.array(PriceCheckRequestItemSchema.extend({ line_cost: z.number(), row_number: z.number() })),
  total_rows: z.number(),
  valid_rows: z.number(),
  warnings: z.array(z.string()),
  store_number: z.string().nullable(),
});

export const UploadAndCompareResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    parse_result: ParseResultSchema,
    comparison: PriceCheckResponseSchema.nullable(),
  }),
});

// ─── Validation warnings ─────────────────────────────────────────────────────

/**
 * A soft pre-flight warning surfaced when submitting an order. Always
 * advisory today; a future phase may promote specific `severity: 'error'`
 * codes to hard rejection at `/orders/submit`.
 *
 * `code` is machine-readable (stable across UI copy changes); `message`
 * is the current human-readable phrasing.
 */
export const ValidationWarningSchema = z.object({
  code: z.string(),
  severity: z.enum(['info', 'warning', 'error']),
  message: z.string(),
  supplier_id: z.string().optional(),
  /** Count of offending items (when the rule is quantitative). */
  item_count: z.number().int().nonnegative().optional(),
});
