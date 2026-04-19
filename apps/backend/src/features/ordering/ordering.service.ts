import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceClient } from '../../shared/database/supabase.js';
import { NotFoundError } from '../../shared/errors/AppError.js';
import { createLogger } from '../../shared/services/logger.service.js';
import { vaultService } from '../../shared/services/vault.service.js';
import type { Database, InsertTables } from '../../shared/types/database.types.js';
import { getOrderHandler } from './ordering.registry.js';
import type {
  FailedOrderItem,
  IOrderHandler,
  OrderItemRequest,
  OrderItemResult,
  OrderSubmissionResponse,
  OrderSubmissionServiceRequest,
  OrderSubmissionSummary,
  SupplierOrderRequest,
  SupplierOrderResult,
} from './ordering.types.js';

/** Item data needed for database persistence */
interface SuccessfulOrderItem {
  supplier_id: string;
  master_product_id: string;
  supplier_product_code: string;
  quantity: number;
  unit_price: number;
  baseline_unit_price: number;
}

/** Metadata returned after order persistence */
interface PersistenceResult {
  orderId: string | null;
  persistedItemsCount: number;
}

/**
 * Maximum time (ms) a single supplier is allowed before being timed out.
 * Prevents one slow supplier from blocking the entire HTTP response.
 */
const SUPPLIER_TIMEOUT_MS = 150_000; // 2.5 minutes
const log = createLogger('OrderingService');

/**
 * Service for orchestrating order submissions to suppliers.
 */
class OrderingService {
  /**
   * Submit orders to multiple suppliers.
   * Processes suppliers in parallel for faster completion.
   * Each supplier gets its own browser instance.
   * Continues with remaining suppliers if one fails.
   * Each supplier has a per-supplier timeout to prevent blocking.
   * Persists successful orders to the database.
   */
  async submitOrders(request: OrderSubmissionServiceRequest): Promise<OrderSubmissionResponse> {
    const supplierCount = request.supplier_orders.length;
    log.info(
      { supplierCount, companyId: request.company_id, locationId: request.location_id },
      'Submitting orders'
    );

    const startTime = Date.now();

    // Process all suppliers in parallel, each with a per-supplier timeout.
    // Use allSettled so an unexpected throw from one supplier (e.g. handler
    // cleanup failing in the finally block) can't abort the whole submission.
    const settled = await Promise.allSettled(
      request.supplier_orders.map((supplierOrder) =>
        this.processSupplierOrderWithTimeout(supplierOrder, request.location_id)
      )
    );

    const results: SupplierOrderResult[] = settled.map((outcome, idx) => {
      if (outcome.status === 'fulfilled') return outcome.value;
      const supplierOrder = request.supplier_orders[idx]!;
      log.error(
        { supplierId: supplierOrder.supplier_id, err: outcome.reason },
        'Supplier order rejected unexpectedly'
      );
      const handler = getOrderHandler(supplierOrder.supplier_id);
      if (!handler) return this.buildNoHandlerResult(supplierOrder);
      return this.buildErrorResult(handler, supplierOrder.items, outcome.reason);
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log.info({ supplierCount, durationSeconds: Number(duration) }, 'All suppliers processed');

    const summary = this.buildSummary(results);

    // Persist successful orders to database
    const persistence = await this.persistOrderToDatabase(request, results);

    return {
      success: summary.failed_suppliers === 0,
      results,
      summary,
      order_id: persistence.orderId ?? undefined,
      persisted_items_count: persistence.persistedItemsCount,
    };
  }

  /**
   * Persist successful order items to the database.
   * Creates: orders record, order_items records, savings_calculations records
   */
  private async persistOrderToDatabase(
    request: OrderSubmissionServiceRequest,
    results: SupplierOrderResult[]
  ): Promise<PersistenceResult> {
    // Collect all successfully submitted items across all suppliers
    const successfulItems: SuccessfulOrderItem[] = [];

    for (const result of results) {
      if (result.items_added === 0) continue;

      // Find the original request to get item details
      const supplierOrder = request.supplier_orders.find(
        (so) => so.supplier_id === result.supplier_id
      );
      if (!supplierOrder) continue;

      // Get successful product codes from this supplier
      const failedCodes = new Set(result.failed_items.map((f) => f.supplier_product_code));

      for (const item of supplierOrder.items) {
        if (!failedCodes.has(item.supplier_product_code)) {
          successfulItems.push({
            supplier_id: result.supplier_id,
            master_product_id: item.master_product_id,
            supplier_product_code: item.supplier_product_code,
            quantity: item.quantity,
            unit_price: item.unit_price,
            baseline_unit_price: item.baseline_unit_price,
          });
        }
      }
    }

    // Don't create empty orders
    if (successfulItems.length === 0) {
      log.info('No successful items to persist');
      return {
        orderId: null,
        persistedItemsCount: 0,
      };
    }

    log.info({ itemCount: successfulItems.length }, 'Persisting items to database');

    const supabase: SupabaseClient<Database> = getServiceClient();
    let createdOrderId: string | null = null;

    try {
      // 1. Create the order record
      const totalAmount = successfulItems.reduce(
        (sum, item) => sum + item.unit_price * item.quantity,
        0
      );

      const orderInsert: InsertTables<'orders'> = {
        location_id: request.location_id,
        created_by: request.user_id,
        order_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        total_amount: totalAmount,
      };

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderInsert as never)
        .select('id')
        .single();

      if (orderError || !order) {
        log.error({ err: orderError }, 'Failed to create order');
        return {
          orderId: null,
          persistedItemsCount: 0,
        };
      }

      const orderId = (order as { id: string }).id;
      createdOrderId = orderId;
      log.info({ orderId }, 'Created order');

      // 2. Look up supplier_product_ids for all items
      const masterProductIds = [...new Set(successfulItems.map((item) => item.master_product_id))];
      const supplierIds = [...new Set(successfulItems.map((item) => item.supplier_id))];

      const { data: supplierProducts, error: spError } = await supabase
        .from('supplier_products')
        .select('id, master_product_id, supplier_id')
        .in('master_product_id', masterProductIds)
        .in('supplier_id', supplierIds);

      if (spError) {
        log.error({ err: spError }, 'Failed to look up supplier_products');
        return {
          orderId,
          persistedItemsCount: 0,
        };
      }

      // Create a lookup map: "master_product_id:supplier_id" -> supplier_product record
      type SupplierProductRecord = {
        id: string;
        master_product_id: string;
        supplier_id: string;
      };
      const spLookup = new Map<string, { id: string; supplier_id: string }>();
      for (const sp of (supplierProducts as SupplierProductRecord[]) || []) {
        spLookup.set(`${sp.master_product_id}:${sp.supplier_id}`, {
          id: sp.id,
          supplier_id: sp.supplier_id,
        });
      }

      // 3. Create order_items records
      const orderItemsToInsert: InsertTables<'order_items'>[] = [];
      const itemMetadata: Array<{
        supplier_id: string;
        unit_price: number;
        baseline_unit_price: number;
        quantity: number;
      }> = [];

      for (const item of successfulItems) {
        const spRecord = spLookup.get(`${item.master_product_id}:${item.supplier_id}`);
        if (!spRecord) {
          log.warn(
            { masterProductId: item.master_product_id, supplierId: item.supplier_id },
            'supplier_product not found'
          );
          continue;
        }

        orderItemsToInsert.push({
          order_id: orderId,
          master_product_id: item.master_product_id,
          supplier_product_id: spRecord.id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.unit_price * item.quantity,
          baseline_unit_price: item.baseline_unit_price,
        });

        itemMetadata.push({
          supplier_id: spRecord.supplier_id,
          unit_price: item.unit_price,
          baseline_unit_price: item.baseline_unit_price,
          quantity: item.quantity,
        });
      }

      if (orderItemsToInsert.length === 0) {
        log.warn('No order items to insert (supplier_products not found)');
        return {
          orderId,
          persistedItemsCount: 0,
        };
      }

      const { data: insertedItems, error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsToInsert as never)
        .select('id');

      if (itemsError) {
        log.error({ err: itemsError, orderId }, 'Failed to create order_items');
        return {
          orderId,
          persistedItemsCount: 0,
        };
      }

      const insertedItemsTyped = (insertedItems as { id: string }[]) || [];
      log.info({ count: insertedItemsTyped.length, orderId }, 'Created order items');

      // 4. Create savings_calculations records
      if (insertedItemsTyped.length > 0) {
        const savingsRecords: InsertTables<'savings_calculations'>[] = [];

        for (let i = 0; i < insertedItemsTyped.length; i++) {
          const insertedItem = insertedItemsTyped[i];
          const metadata = itemMetadata[i];

          if (!insertedItem || !metadata) continue;

          const chosenPrice = metadata.unit_price;
          const baselinePrice = metadata.baseline_unit_price;
          const qty = metadata.quantity;
          const deltaVsBaseline = (chosenPrice - baselinePrice) * qty;
          const savingsPercentage = baselinePrice > 0 ? deltaVsBaseline / (baselinePrice * qty) : 0;

          savingsRecords.push({
            company_id: request.company_id,
            order_item_id: insertedItem.id,
            baseline_price: baselinePrice,
            chosen_supplier_id: metadata.supplier_id,
            chosen_price: chosenPrice,
            delta_vs_baseline: deltaVsBaseline,
            savings_percentage: savingsPercentage,
          });
        }

        if (savingsRecords.length > 0) {
          const { error: savingsError } = await supabase
            .from('savings_calculations')
            .insert(savingsRecords as never);

          if (savingsError) {
            log.error({ err: savingsError, orderId }, 'Failed to create savings_calculations');
            // Don't return - order items are already saved
          } else {
            log.info({ count: savingsRecords.length, orderId }, 'Created savings calculations');
          }
        }
      }

      log.info({ orderId }, 'Database persistence complete');
      return {
        orderId,
        persistedItemsCount: insertedItemsTyped.length,
      };
    } catch (error) {
      log.error({ err: error, orderId: createdOrderId }, 'Error persisting to database');
      // Don't throw - supplier submissions already succeeded
      return {
        orderId: createdOrderId,
        persistedItemsCount: 0,
      };
    }
  }

  /**
   * Wrap processSupplierOrder with a per-supplier timeout.
   * If the supplier takes longer than SUPPLIER_TIMEOUT_MS, return a timeout error result
   * so other suppliers' results are not held hostage.
   *
   * The timer is always cleared when the real operation settles to prevent
   * dangling log messages and double-cleanup calls.
   */
  private async processSupplierOrderWithTimeout(
    order: SupplierOrderRequest,
    locationId: string
  ): Promise<SupplierOrderResult> {
    const handler = getOrderHandler(order.supplier_id);
    const supplierName = handler?.name ?? 'Unknown';
    const timeoutSeconds = SUPPLIER_TIMEOUT_MS / 1000;

    let timerId: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<SupplierOrderResult>((resolve) => {
      timerId = setTimeout(() => {
        log.error(
          { supplierName, timeoutSeconds, supplierId: order.supplier_id },
          'Supplier timed out'
        );

        // Attempt cleanup in the background so the browser doesn't leak
        if (handler) {
          handler
            .cleanup()
            .catch((err) =>
              log.warn(
                { supplierName, supplierId: order.supplier_id, err },
                'Cleanup after timeout failed'
              )
            );
        }

        resolve({
          supplier_id: order.supplier_id,
          supplier_name: supplierName,
          success: false,
          basket_url: handler?.getBasketUrl() ?? '',
          items_requested: order.items.length,
          items_added: 0,
          items_failed: order.items.length,
          failed_items: order.items.map((item) => ({
            supplier_product_code: item.supplier_product_code,
            product_name: item.product_name,
            quantity: item.quantity,
            reason: 'network_error' as const,
            details: `Supplier processing timed out after ${timeoutSeconds} seconds`,
          })),
          error: `Processing timed out after ${timeoutSeconds} seconds. The supplier website may be slow or unresponsive.`,
          error_type: 'general',
        });
      }, SUPPLIER_TIMEOUT_MS);
    });

    try {
      return await Promise.race([this.processSupplierOrder(order, locationId), timeoutPromise]);
    } finally {
      // Always clear the timer — whether the real operation won or the timeout won.
      // Prevents dangling timers from logging misleading messages and double-cleanup.
      clearTimeout(timerId);
    }
  }

  /**
   * Process order for a single supplier.
   */
  private async processSupplierOrder(
    order: SupplierOrderRequest,
    locationId: string
  ): Promise<SupplierOrderResult> {
    const handler = getOrderHandler(order.supplier_id);

    // No handler registered for this supplier
    if (!handler) {
      log.warn({ supplierId: order.supplier_id }, 'No handler for supplier');
      return this.buildNoHandlerResult(order);
    }

    log.info(
      { supplierId: order.supplier_id, supplierName: handler.name, itemCount: order.items.length },
      'Processing supplier order'
    );

    try {
      // Get credentials for this supplier at this location
      const credentials = await vaultService.getCredentialsForLocation(
        locationId,
        order.supplier_id
      );

      // Initialize browser and login
      await handler.initialize();
      await handler.login(credentials);

      // Submit order with batching if needed
      const itemResults = await this.submitWithBatching(handler, order.items);

      // Build result
      return this.buildSuccessResult(handler, order.items, itemResults);
    } catch (error) {
      // Handle missing credentials with a structured error type
      if (error instanceof NotFoundError) {
        log.warn(
          { supplierName: handler.name, supplierId: order.supplier_id, locationId },
          'Missing credentials for supplier'
        );
        return this.buildMissingCredentialsResult(handler, order);
      }

      log.error(
        { supplierName: handler.name, supplierId: order.supplier_id, err: error },
        'Supplier order failed'
      );
      return this.buildErrorResult(handler, order.items, error);
    } finally {
      // Always cleanup browser resources
      await handler.cleanup();
    }
  }

  /**
   * Submit items with batching based on handler's maxItemsPerRequest config.
   */
  private async submitWithBatching(
    handler: IOrderHandler,
    items: OrderItemRequest[]
  ): Promise<OrderItemResult[]> {
    const { maxItemsPerRequest, requestDelay } = handler.config;
    const results: OrderItemResult[] = [];

    // Split into batches
    for (let i = 0; i < items.length; i += maxItemsPerRequest) {
      const batch = items.slice(i, i + maxItemsPerRequest);
      const batchResults = await handler.submitOrder(batch);
      results.push(...batchResults);

      // Delay between batches (not after the last one)
      if (i + maxItemsPerRequest < items.length) {
        await this.delay(requestDelay.min, requestDelay.max);
      }
    }

    return results;
  }

  private async delay(min: number, max: number): Promise<void> {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Build result when no handler is registered.
   */
  private buildNoHandlerResult(order: SupplierOrderRequest): SupplierOrderResult {
    return {
      supplier_id: order.supplier_id,
      supplier_name: 'Unknown',
      success: false,
      basket_url: '',
      items_requested: order.items.length,
      items_added: 0,
      items_failed: order.items.length,
      failed_items: order.items.map((item) => ({
        supplier_product_code: item.supplier_product_code,
        product_name: item.product_name,
        quantity: item.quantity,
        reason: 'unknown' as const,
        details: 'No order handler registered for this supplier',
      })),
      error: 'No order handler registered for this supplier',
      error_type: 'no_handler',
    };
  }

  /**
   * Build result when supplier credentials are not configured for the location.
   */
  private buildMissingCredentialsResult(
    handler: IOrderHandler,
    order: SupplierOrderRequest
  ): SupplierOrderResult {
    return {
      supplier_id: handler.supplierId,
      supplier_name: handler.name,
      success: false,
      basket_url: '',
      items_requested: order.items.length,
      items_added: 0,
      items_failed: order.items.length,
      failed_items: order.items.map((item) => ({
        supplier_product_code: item.supplier_product_code,
        product_name: item.product_name,
        quantity: item.quantity,
        reason: 'unknown' as const,
        details: 'Supplier credentials not configured for this location',
      })),
      error:
        'Supplier credentials have not been configured for this location. Please add credentials in your company settings.',
      error_type: 'missing_credentials',
    };
  }

  /**
   * Build result from successful submission.
   */
  private buildSuccessResult(
    handler: IOrderHandler,
    items: OrderItemRequest[],
    itemResults: OrderItemResult[]
  ): SupplierOrderResult {
    const successful = itemResults.filter((r) => r.success);
    const failed = itemResults.filter((r) => !r.success);

    const failedItems: FailedOrderItem[] = failed.map((f) => {
      const originalItem = items.find((i) => i.supplier_product_code === f.supplier_product_code);
      return {
        supplier_product_code: f.supplier_product_code,
        product_name: originalItem?.product_name,
        quantity: originalItem?.quantity ?? 0,
        reason: 'api_error' as const,
        details: f.error,
      };
    });

    return {
      supplier_id: handler.supplierId,
      supplier_name: handler.name,
      success: failed.length === 0,
      basket_url: handler.getBasketUrl(),
      items_requested: items.length,
      items_added: successful.length,
      items_failed: failed.length,
      failed_items: failedItems,
    };
  }

  /**
   * Build result from error (login failed, etc).
   */
  private buildErrorResult(
    handler: IOrderHandler,
    items: OrderItemRequest[],
    error: unknown
  ): SupplierOrderResult {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      supplier_id: handler.supplierId,
      supplier_name: handler.name,
      success: false,
      basket_url: handler.getBasketUrl(),
      items_requested: items.length,
      items_added: 0,
      items_failed: items.length,
      failed_items: items.map((item) => ({
        supplier_product_code: item.supplier_product_code,
        product_name: item.product_name,
        quantity: item.quantity,
        reason: 'network_error' as const,
        details: errorMessage,
      })),
      error: errorMessage,
    };
  }

  /**
   * Build summary from all results.
   */
  private buildSummary(results: SupplierOrderResult[]): OrderSubmissionSummary {
    return {
      total_suppliers: results.length,
      successful_suppliers: results.filter((r) => r.success).length,
      failed_suppliers: results.filter((r) => !r.success).length,
      total_items_requested: results.reduce((sum, r) => sum + r.items_requested, 0),
      total_items_added: results.reduce((sum, r) => sum + r.items_added, 0),
      total_items_failed: results.reduce((sum, r) => sum + r.items_failed, 0),
    };
  }
}

// Singleton instance
export const orderingService = new OrderingService();
