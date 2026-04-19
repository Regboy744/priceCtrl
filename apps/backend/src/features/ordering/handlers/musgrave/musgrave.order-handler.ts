import {
  type MusgraveAuthMetadata,
  loginMusgrave,
} from '../../../../shared/services/http-auth/index.js';
import type { SupplierCredentials } from '../../../../shared/services/vault.service.js';
import { BaseHttpOrderHandler } from '../../base.http-order-handler.js';
import type {
  OrderItemRequest,
  OrderItemResult,
  SupplierOrderConfig,
} from '../../ordering.types.js';
import { MUSGRAVE_ORDER_CONFIG } from './musgrave.order-config.js';

/**
 * Order handler for Musgrave Marketplace.
 *
 * Pure HTTP — login uses the shared `loginMusgrave` (OAuth2 password grant
 * to the INTERSHOP REST API). Bypasses Cloudflare/Radware entirely.
 *
 * Submission: POST JSON array to the basket REST endpoint, authenticated via
 * the `authentication-token` header (apiToken from login).
 */
export class MusgraveOrderHandler extends BaseHttpOrderHandler {
  readonly supplierName = 'Musgrave Marketplace';
  readonly name = 'Musgrave Marketplace';
  readonly baseUrl = 'https://www.musgravemarketplace.ie';
  readonly config: SupplierOrderConfig = MUSGRAVE_ORDER_CONFIG;

  async login(credentials: SupplierCredentials): Promise<void> {
    this.setSession(await loginMusgrave(credentials));
    this.log.info('Successfully logged in and obtained API token');
  }

  async submitOrder(items: OrderItemRequest[]): Promise<OrderItemResult[]> {
    this.requireSession();

    const meta = this.sessionMetadata as MusgraveAuthMetadata | undefined;
    if (!meta?.apiToken) {
      throw new Error('Musgrave login produced no apiToken');
    }

    this.log.info({ itemCount: items.length }, 'Adding items to basket');

    const payload = items.map((item) => ({
      product: item.supplier_product_code,
      quantity: { value: item.quantity },
    }));

    try {
      const response = await this.httpPostJson(this.config.orderEndpoint, payload, {
        accept: 'application/vnd.intershop.basket.v1+json',
        'authentication-token': meta.apiToken,
      });

      if (response.status < 200 || response.status >= 300) {
        this.log.error(
          { status: response.status, bodyPreview: response.body.slice(0, 300) },
          'API error'
        );
        return this.failAll(items, `HTTP ${response.status}`);
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
