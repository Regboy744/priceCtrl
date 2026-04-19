import { loginOreillys } from '../../../../shared/services/http-auth/index.js';
import type { SupplierCredentials } from '../../../../shared/services/vault.service.js';
import { BaseHttpOrderHandler } from '../../base.http-order-handler.js';
import type {
  OrderItemRequest,
  OrderItemResult,
  SupplierOrderConfig,
} from '../../ordering.types.js';
import { OREILLYS_ORDER_CONFIG } from './oreillys.order-config.js';

/**
 * Order handler for O'Reillys Wholesale.
 *
 * Pure HTTP — same login flow as the scraper (shared http-auth module).
 *
 * Submission: POST /products/quickAdd.asp with fixed 32 slots
 * (product_code1..32, product_qty1..32). Empty slots are still required.
 */
export class OreillysOrderHandler extends BaseHttpOrderHandler {
  /**
   * TODO: The registry matches handlers to suppliers by name (case-insensitive).
   * This is fragile - names can have typos, apostrophes, or formatting differences.
   * Consider refactoring to use a stable identifier like a `code` or `slug` field
   * in the suppliers table (e.g., 'oreillys') instead of matching by name.
   * See: ordering.registry.ts
   */
  readonly supplierName = "O'Reillys Wholesale";
  readonly name = "O'Reilly's Wholesale";
  readonly baseUrl = 'https://order.oreillyswholesale.com';
  readonly config: SupplierOrderConfig = OREILLYS_ORDER_CONFIG;

  async login(credentials: SupplierCredentials): Promise<void> {
    this.setSession(await loginOreillys(credentials));
    this.log.info('Successfully logged in');
  }

  async submitOrder(items: OrderItemRequest[]): Promise<OrderItemResult[]> {
    this.requireSession();
    this.log.info({ itemCount: items.length }, 'Adding items to basket');

    // O'Reillys quickAdd accepts a fixed grid of 32 slots; pad with empties.
    const itemsToSend = items.slice(0, 32);
    const formData: Record<string, string> = {};
    for (let i = 0; i < 32; i++) {
      const slotNum = i + 1;
      const item = itemsToSend[i];
      formData[`product_code${slotNum}`] = item ? item.supplier_product_code : '';
      formData[`product_qty${slotNum}`] = item ? item.quantity.toString() : '';
    }

    try {
      const response = await this.httpPostForm(this.config.orderEndpoint, formData, {
        referer: this.config.basketUrl,
      });

      if (response.status < 200 || response.status >= 300) {
        this.log.error({ status: response.status }, 'Form submission failed');
        return this.failAll(itemsToSend, `HTTP ${response.status}`);
      }

      this.log.info({ itemCount: itemsToSend.length }, 'Successfully added items to basket');
      return this.succeedAll(itemsToSend);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      this.log.error({ errorMessage }, 'Request failed');
      return this.failAll(itemsToSend, errorMessage);
    }
  }
}
