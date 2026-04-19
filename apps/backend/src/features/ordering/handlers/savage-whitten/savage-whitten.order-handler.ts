import { loginSavageWhitten } from '../../../../shared/services/http-auth/index.js';
import type { SupplierCredentials } from '../../../../shared/services/vault.service.js';
import { BaseHttpOrderHandler } from '../../base.http-order-handler.js';
import type {
  OrderItemRequest,
  OrderItemResult,
  SupplierOrderConfig,
} from '../../ordering.types.js';
import { SAVAGE_WHITTEN_ORDER_CONFIG } from './savage-whitten.order-config.js';

/**
 * Order handler for Savage & Whitten.
 *
 * Pure HTTP — same login flow as the scraper (shared http-auth module).
 *
 * Submission: POST form with array notation
 *   quickAddItems[n][Code], quickAddItems[n][Quantity], quickAddItems[n][ProductId]
 * to /umbraco/surface/Basket/QuickAddAddToBasket. ProductId is required.
 */
export class SavageWhittenOrderHandler extends BaseHttpOrderHandler {
  readonly supplierName = 'Savage & Whitten';
  readonly name = 'Savage & Whitten';
  readonly baseUrl = 'https://www.savageandwhitten.com';
  readonly config: SupplierOrderConfig = SAVAGE_WHITTEN_ORDER_CONFIG;

  async login(credentials: SupplierCredentials): Promise<void> {
    this.setSession(await loginSavageWhitten(credentials));
    this.log.info('Successfully logged in');
  }

  async submitOrder(items: OrderItemRequest[]): Promise<OrderItemResult[]> {
    this.requireSession();
    this.log.info({ itemCount: items.length }, 'Adding items to basket');

    const itemsWithoutProductId = items.filter((item) => !item.product_id);
    if (itemsWithoutProductId.length > 0) {
      this.log.warn(
        { missingProductIdCount: itemsWithoutProductId.length },
        'Items missing product_id'
      );
    }

    const formData: Record<string, string> = {};
    items.forEach((item, index) => {
      formData[`quickAddItems[${index}][Code]`] = item.supplier_product_code;
      formData[`quickAddItems[${index}][Quantity]`] = item.quantity.toString();
      if (item.product_id) {
        formData[`quickAddItems[${index}][ProductId]`] = item.product_id;
      }
    });

    try {
      const response = await this.httpPostForm(this.config.orderEndpoint, formData, {
        'x-requested-with': 'XMLHttpRequest',
        accept: 'application/json, text/javascript, */*; q=0.01',
        referer: this.config.basketUrl,
      });

      const bodyPreview = response.body.replace(/\s+/g, ' ').slice(0, 500);

      if (response.status < 200 || response.status >= 300) {
        this.log.error({ status: response.status, bodyPreview }, 'Form submission failed');
        return this.failAll(items, `HTTP ${response.status}`);
      }

      // Endpoint returns 200 + HTML fragment (NOT JSON):
      //   Success: "<p class=...> N item/s added to your basket. </p>" + dataLayer push
      //   Failure: "<p class=...> Some of the products you selected were invalid </p>" + list
      const lowerBody = response.body.toLowerCase();
      const isSuccess = lowerBody.includes('added to your basket');
      const isFailure = lowerBody.includes('invalid product');

      if (isFailure || !isSuccess) {
        this.log.error({ bodyPreview }, 'QuickAdd rejected request');
        return this.failAll(items, `Basket API rejected request: ${bodyPreview}`);
      }

      this.log.info({ itemCount: items.length }, 'Successfully added items to basket');
      return this.succeedAll(items);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      this.log.error({ errorMessage }, 'Request failed');
      return this.failAll(items, errorMessage);
    }
  }
}
