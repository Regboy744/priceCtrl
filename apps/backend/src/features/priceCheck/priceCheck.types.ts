/**
 * Price-check backend-internal types + re-exports of shared contracts.
 *
 * The shared exchange shapes (response + request envelopes, product,
 * evaluation, summary, etc.) now live in `@pricectrl/contracts`
 * and are the single source of truth across services.
 *
 * This file only keeps shapes that never cross the HTTP boundary:
 *   - OrderItem (parser intermediate with row_number)
 *   - PricingComparisonRow (flat RPC response row)
 *   - FileUploadConfig (controller-only parsing hints)
 */

import { z } from 'zod';

// Re-export shared shapes so existing `./priceCheck.types.js` imports keep
// working without churn. Code that imports these names resolves via the
// contracts package — no duplicate definition.
export {
  PriceCheckRequestSchema,
  type BestOverall,
  type ParseResult,
  type PriceCheckRequest,
  type PriceCheckResponse,
  type PriceCheckSummary,
  type ProductComparison,
  type ProductEvaluation,
  type SummaryCounts,
  type SummaryEvaluationResults,
  type SummaryOrderTotals,
  type Supplier as SupplierInfo,
  type SupplierConstraint,
  type SupplierPrice,
  type SupplierRanking,
  type UploadAndCompareResponse,
  type ValidationWarning,
} from '@pricectrl/contracts/priceCheck';

// ─── Backend-internal types ──────────────────────────────────────────────────

/**
 * Single item extracted from the order XLS file.
 * Parser-internal: carries the source row number for debugging but is
 * projected down to the shared `PriceCheckRequestItem` shape before any
 * cross-service exchange.
 */
export interface OrderItem {
  article_code: string;
  quantity: number;
  line_cost: number;
  unit_cost: number;
  row_number: number;
}

/**
 * Flat row shape returned by the `get_pricing_comparison` Postgres RPC.
 * Never exposed to clients — service layer normalizes these into the
 * shared `ProductComparison` shape.
 */
export interface PricingComparisonRow {
  product_id: string;
  article_code: string;
  description: string;
  ean_code: string;
  unit_size: string | null;
  supplier_id: string;
  supplier_name: string;
  is_active: boolean;
  final_price: number;
  catalog_price: number;
  is_special_price: boolean;
  special_price_notes: string | null;
  valid_until: string | null;
  availability_status: string;
  supplier_product_code: string;
  internal_product_id: string | null;
  unit_cost_incl_vat: number | null;
  pack_count: number | null;
  pack_unit_size: string | null;
}

// ─── File-upload controller helpers ──────────────────────────────────────────

/**
 * Optional parsing hints sent alongside the XLS upload. Backend-only:
 * the frontend never invents these, they're for manual override when the
 * auto-detector picks the wrong columns.
 */
export const FileUploadConfigSchema = z.object({
  article_column: z.string().optional(),
  quantity_column: z.string().optional(),
  cost_column: z.string().optional(),
  skip_rows: z.number().int().min(0).optional(),
});

export type FileUploadConfig = z.infer<typeof FileUploadConfigSchema>;
