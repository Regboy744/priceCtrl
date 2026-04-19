import { z } from 'zod';
import type { SupplierCredentials } from '../../shared/services/vault.service.js';

// ============ Request Schemas ============

export const OrderItemRequestSchema = z.object({
  /** Supplier's product code/SKU */
  supplier_product_code: z.string().min(1),
  /** Quantity to order */
  quantity: z.number().int().positive(),
  /** Internal supplier product ID (required for some suppliers like S&W) */
  product_id: z.string().optional(),
  /** Master product ID - required for database persistence */
  master_product_id: z.string().uuid(),
  /** Supplier unit price - required for database persistence */
  unit_price: z.number().positive(),
  /** Original order unit price - required for savings calculation */
  baseline_unit_price: z.number().positive(),
  /** EAN code for reference */
  ean_code: z.string().optional(),
  /** Product name for error messages */
  product_name: z.string().optional(),
});

export const SupplierOrderRequestSchema = z.object({
  supplier_id: z.string().uuid(),
  items: z.array(OrderItemRequestSchema).min(1),
});

export const OrderSubmissionRequestSchema = z.object({
  company_id: z.string().uuid(),
  location_id: z.string().uuid(),
  supplier_orders: z.array(SupplierOrderRequestSchema).min(1),
});

/** Extended request with user context for service layer */
export interface OrderSubmissionServiceRequest extends OrderSubmissionRequest {
  user_id: string;
}

// ============ Inferred Types ============

export type OrderItemRequest = z.infer<typeof OrderItemRequestSchema>;
export type SupplierOrderRequest = z.infer<typeof SupplierOrderRequestSchema>;
export type OrderSubmissionRequest = z.infer<typeof OrderSubmissionRequestSchema>;

// ============ Response Types ============

export type FailureReason =
  | 'invalid_sku'
  | 'out_of_stock'
  | 'api_error'
  | 'network_error'
  | 'unknown';

export interface FailedOrderItem {
  supplier_product_code: string;
  product_name?: string;
  quantity: number;
  reason: FailureReason;
  details?: string;
}

/** Error type codes for structured error handling */
export type OrderErrorType = 'missing_credentials' | 'no_handler' | 'general';

export interface SupplierOrderResult {
  supplier_id: string;
  supplier_name: string;
  success: boolean;
  basket_url: string;
  items_requested: number;
  items_added: number;
  items_failed: number;
  failed_items: FailedOrderItem[];
  error?: string;
  /** Structured error type for frontend to render context-specific UI */
  error_type?: OrderErrorType;
}

export interface OrderSubmissionSummary {
  total_suppliers: number;
  successful_suppliers: number;
  failed_suppliers: number;
  total_items_requested: number;
  total_items_added: number;
  total_items_failed: number;
}

export interface OrderSubmissionResponse {
  success: boolean;
  results: SupplierOrderResult[];
  summary: OrderSubmissionSummary;
  /** Persisted order ID in RetailCtrl (used for post-submit barcode labels) */
  order_id?: string;
  /** Number of order_items successfully persisted */
  persisted_items_count?: number;
}

// ============ Handler Types ============

export interface OrderItemResult {
  supplier_product_code: string;
  success: boolean;
  error?: string;
}

/**
 * Strategy for submitting orders to supplier
 * - api_json_bulk: POST JSON array (Musgrave)
 * - form_bulk: POST form with array notation (Savage & Whitten)
 * - form_batch: POST form with fixed slots (O'Reillys - max 32)
 * - url_single: GET with URL params, one at a time (Barry's)
 */
export type SubmissionStrategy = 'api_json_bulk' | 'form_bulk' | 'form_batch' | 'url_single';

export interface SupplierOrderConfig {
  submissionStrategy: SubmissionStrategy;
  basketUrl: string;
  orderEndpoint: string;
  maxItemsPerRequest: number;
  requestDelay: { min: number; max: number };
  requiresProductId: boolean;
  /** Number of concurrent requests for parallel batch processing (default: 1 = sequential) */
  batchSize?: number;
}

/**
 * Interface for supplier order handlers
 */
export interface IOrderHandler {
  /** Supplier ID from database - set by registry */
  supplierId: string;

  /** Supplier name as stored in database - used for ID lookup */
  readonly supplierName: string;

  /** Human-readable display name */
  readonly name: string;

  /** Base URL of the supplier website */
  readonly baseUrl: string;

  /** Handler configuration */
  readonly config: SupplierOrderConfig;

  /** Initialize browser and page */
  initialize(): Promise<void>;

  /** Login to supplier website */
  login(credentials: SupplierCredentials): Promise<void>;

  /** Submit order items to basket */
  submitOrder(items: OrderItemRequest[]): Promise<OrderItemResult[]>;

  /** Get the basket URL for frontend to open */
  getBasketUrl(): string;

  /** Cleanup resources */
  cleanup(): Promise<void>;
}
