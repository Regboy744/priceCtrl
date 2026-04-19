import { loginBarryGroup } from '../../../../shared/services/http-auth/index.js';
import type { SupplierCredentials } from '../../../../shared/services/vault.service.js';
import { BaseHttpOrderHandler } from '../../base.http-order-handler.js';
import type {
  OrderItemRequest,
  OrderItemResult,
  SupplierOrderConfig,
} from '../../ordering.types.js';
import { BARRY_GROUP_ORDER_CONFIG } from './barry-group.order-config.js';

/**
 * Order handler for Barry Group (ind.barrys.ie).
 *
 * Pure HTTP — same login flow as the scraper (shared http-auth module).
 *
 * Submission: GET /products/AddLine.asp?ProdCode=X&Qty=Y, one item per
 * request. Items are processed in concurrent batches of `config.batchSize`
 * for ~3-4x speedup over sequential.
 *
 * Server replies with XML:
 *   <Add><Message>refresh</Message><QtyInBasket>N</QtyInBasket></Add>
 * QtyInBasket > 0 = success, 0 = item rejected, missing = session expired.
 */
export class BarryGroupOrderHandler extends BaseHttpOrderHandler {
  readonly supplierName = 'Barry Group';
  readonly name = 'Barry Group';
  readonly baseUrl = 'https://ind.barrys.ie';
  readonly config: SupplierOrderConfig = BARRY_GROUP_ORDER_CONFIG;

  async login(credentials: SupplierCredentials): Promise<void> {
    this.setSession(await loginBarryGroup(credentials));
    this.log.info('Successfully logged in');
  }

  async submitOrder(items: OrderItemRequest[]): Promise<OrderItemResult[]> {
    this.requireSession();
    const batchSize = this.config.batchSize ?? 1;
    this.log.info({ itemCount: items.length, batchSize }, 'Adding items to basket');

    const results: OrderItemResult[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map((item) => this.addSingleItem(item)));
      results.push(...batchResults);

      if (i + batchSize < items.length) {
        await this.sleep(this.config.requestDelay.min, this.config.requestDelay.max);
      }
    }

    const successCount = results.filter((r) => r.success).length;
    this.log.info({ successCount, itemCount: items.length }, 'Finished adding items to basket');
    return results;
  }

  private async addSingleItem(item: OrderItemRequest): Promise<OrderItemResult> {
    const url = `${this.config.orderEndpoint}?ProdCode=${encodeURIComponent(item.supplier_product_code)}&Qty=${item.quantity}`;

    try {
      const response = await this.httpGet(url, {
        accept: 'text/xml,application/xml,*/*;q=0.9',
        'x-requested-with': 'XMLHttpRequest',
        referer: this.config.basketUrl,
      });

      this.log.debug(
        {
          supplierProductCode: item.supplier_product_code,
          status: response.status,
          bodyPreview: response.body.replace(/\s+/g, ' ').slice(0, 300),
        },
        'AddLine response received'
      );

      if (response.status !== 200) {
        return {
          supplier_product_code: item.supplier_product_code,
          success: false,
          error: `HTTP ${response.status}`,
        };
      }

      const qtyMatch = response.body.match(/<QtyInBasket>(\d+)<\/QtyInBasket>/i);
      const qtyInBasket = qtyMatch ? Number.parseInt(qtyMatch[1], 10) : -1;

      if (qtyInBasket === 0) {
        this.log.error(
          { supplierProductCode: item.supplier_product_code },
          'Item not added - QtyInBasket is 0'
        );
        return {
          supplier_product_code: item.supplier_product_code,
          success: false,
          error: 'Item not added to basket',
        };
      }

      if (qtyInBasket < 0) {
        const lower = response.body.toLowerCase();
        if (lower.includes('login') || lower.includes('please log in')) {
          return {
            supplier_product_code: item.supplier_product_code,
            success: false,
            error: 'Session expired - login required',
          };
        }
        this.log.warn(
          { supplierProductCode: item.supplier_product_code },
          'Could not parse QtyInBasket'
        );
      }

      return { supplier_product_code: item.supplier_product_code, success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      this.log.error(
        { supplierProductCode: item.supplier_product_code, errorMessage },
        'Request failed'
      );
      return {
        supplier_product_code: item.supplier_product_code,
        success: false,
        error: errorMessage,
      };
    }
  }

  private sleep(min: number, max: number): Promise<void> {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
