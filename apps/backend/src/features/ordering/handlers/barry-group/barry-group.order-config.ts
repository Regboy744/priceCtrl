import type { SupplierOrderConfig } from '../../ordering.types.js';

/**
 * Barry Group order configuration.
 * Login config is defined in BARRY_GROUP_CONFIG.auth (supplier definition).
 */
export const BARRY_GROUP_ORDER_CONFIG: SupplierOrderConfig = {
  submissionStrategy: 'url_single',
  basketUrl: 'https://ind.barrys.ie/products/basket.asp',
  orderEndpoint: 'https://ind.barrys.ie/products/AddLine.asp',
  maxItemsPerRequest: 100, // Pass all items to handler (handler batches internally via batchSize)
  requestDelay: { min: 300, max: 600 },
  requiresProductId: false,
  batchSize: 4, // Process 4 items concurrently for ~3-4x speedup
};
