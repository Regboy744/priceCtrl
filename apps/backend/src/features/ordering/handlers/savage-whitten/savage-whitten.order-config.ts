import type { SupplierOrderConfig } from '../../ordering.types.js';

/**
 * Savage & Whitten order configuration.
 * Login config is defined in SAVAGE_WHITTEN_CONFIG.auth (supplier definition).
 */
export const SAVAGE_WHITTEN_ORDER_CONFIG: SupplierOrderConfig = {
  submissionStrategy: 'form_bulk',
  basketUrl: 'https://www.savageandwhitten.com/basket',
  orderEndpoint: 'https://www.savageandwhitten.com/umbraco/surface/Basket/QuickAddAddToBasket',
  maxItemsPerRequest: 50, // Can send array, but batch for safety
  requestDelay: { min: 200, max: 500 },
  requiresProductId: true, // Needs ProductId in addition to Code
};
