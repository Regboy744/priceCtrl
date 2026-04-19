/**
 * Price-check frontend types.
 *
 * Shared exchange shapes (everything that crosses the HTTP boundary) live
 * in `@pricectrl/contracts` and are re-exported here. Types unique
 * to the frontend — UI selection state, order-submission payloads, grouped
 * views — stay local.
 *
 * When a shared type is imported with a frontend-local name (e.g.
 * `ComparisonSummary` ↔ `PriceCheckSummary`), the alias preserves the
 * existing call sites while the canonical name stays in the contracts
 * package.
 */

import type {
 BestOverall,
 ParseResult,
 PriceCheckResponse,
 PriceCheckSummary,
 ProductComparison,
 ProductEvaluation,
 ProductOrderInfo,
 SummaryCounts,
 SummaryEvaluationResults,
 SummaryOrderTotals,
 Supplier,
 SupplierPrice,
 SupplierRanking,
 UploadAndCompareResponse,
} from '@pricectrl/contracts/priceCheck'

// Shared re-exports — canonical shape lives in contracts.
export type {
 BestOverall,
 ParseResult,
 ProductComparison,
 ProductEvaluation,
 SummaryCounts,
 SummaryEvaluationResults,
 SummaryOrderTotals,
 Supplier,
 SupplierPrice,
 SupplierRanking,
}

/** Frontend historical name for `PriceCheckSummary`. */
export type ComparisonSummary = PriceCheckSummary

/** Frontend historical name for `PriceCheckResponse`. */
export type ComparisonResult = PriceCheckResponse

/** Frontend historical name for `UploadAndCompareResponse`. */
export type PriceCheckApiResponse = UploadAndCompareResponse

/** The reduced per-product order info nested inside `ProductComparison.order`. */
export type OrderItem = ProductOrderInfo

// =============================================================================
// Frontend-only types
// =============================================================================

/**
 * Products grouped by EAN for the comparison table (primary + variants).
 */
export interface ProductGroup {
 ean_code: string
 primary: ProductComparison
 variants: ProductComparison[]
 hasVariants: boolean
}

/**
 * Frontend state for the price-check feature page.
 */
export interface PriceCheckState {
 isLoading: boolean
 error: string | null
 selectedFile: File | null
 result: PriceCheckApiResponse['data'] | null
}

// =============================================================================
// Order submission types
// =============================================================================

export interface OrderItemRequest {
 supplier_product_code: string
 quantity: number
 product_name?: string
 product_id?: string // Required for Savage & Whitten
 // Fields required for database persistence
 master_product_id: string
 unit_price: number // Supplier price
 baseline_unit_price: number // Original order price
}

export interface SupplierOrderRequest {
 supplier_id: string
 items: OrderItemRequest[]
}

export interface OrderSubmitRequest {
 company_id: string
 location_id: string
 supplier_orders: SupplierOrderRequest[]
}

export type FailureReason =
 | 'invalid_sku'
 | 'out_of_stock'
 | 'api_error'
 | 'network_error'
 | 'unknown'

export interface FailedItem {
 supplier_product_code: string
 product_name?: string
 quantity: number
 reason: FailureReason
 details?: string
}

/** Error type codes for structured error handling */
export type OrderErrorType = 'missing_credentials' | 'no_handler' | 'general'

export interface SupplierOrderResult {
 supplier_id: string
 supplier_name: string
 success: boolean
 basket_url: string
 items_requested: number
 items_added: number
 items_failed: number
 failed_items: FailedItem[]
 error?: string
 /** Structured error type for rendering context-specific UI */
 error_type?: OrderErrorType
}

export interface OrderSubmitSummary {
 total_suppliers: number
 successful_suppliers: number
 failed_suppliers: number
 total_items_requested: number
 total_items_added: number
 total_items_failed: number
}

export interface OrderSubmitResponseData {
 success: boolean
 results: SupplierOrderResult[]
 summary: OrderSubmitSummary
 /** Persisted RetailCtrl order id (for post-submit label flows) */
 order_id?: string
 /** Number of order lines successfully persisted to order_items */
 persisted_items_count?: number
}

export interface OrderSubmitResponse {
 success: boolean
 data: OrderSubmitResponseData
}

/**
 * UI selection — which supplier/variant the user has picked for each product.
 */
export interface ProductSelection {
 product_id: string
 article_code: string
 description: string
 supplier_id: string
 supplier_name: string
 supplier_product_code: string
 quantity: number
 order_unit_price: number
 supplier_unit_price: number
 savings: number
 internal_product_id?: string | null
}

/**
 * Location option for the upload form's location picker.
 */
export interface LocationOption {
 id: string
 name: string
 location_number: number
 company_id?: string
 company_name?: string
}
