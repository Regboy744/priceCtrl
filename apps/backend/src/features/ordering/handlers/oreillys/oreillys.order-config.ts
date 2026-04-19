import type { SupplierOrderConfig } from '../../ordering.types.js';

/**
 * O'Reillys Wholesale order configuration.
 * Login config is defined in OREILLYS_CONFIG.auth (supplier definition).
 */
export const OREILLYS_ORDER_CONFIG: SupplierOrderConfig = {
  submissionStrategy: 'form_batch',
  basketUrl: 'https://order.oreillyswholesale.com/products/basket.asp',
  orderEndpoint: 'https://order.oreillyswholesale.com/products/quickAdd.asp',
  maxItemsPerRequest: 32, // Fixed form with 32 slots
  requestDelay: { min: 500, max: 1000 },
  requiresProductId: false,
};
