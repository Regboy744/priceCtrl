import type { SupplierOrderConfig } from '../../ordering.types.js';

export const MUSGRAVE_ORDER_CONFIG: SupplierOrderConfig = {
  submissionStrategy: 'api_json_bulk',
  basketUrl: 'https://www.musgravemarketplace.ie/basket',
  orderEndpoint:
    'https://www-api.musgravemarketplace.ie/INTERSHOP/rest/WFS/musgrave-MWPIRL-Site/-;loc=en_IE;cur=EUR/baskets/current/items?msgSkipFulfillmentCheck&include=bulkUpdate',
  maxItemsPerRequest: 100, // Can send many, but batch for safety
  requestDelay: { min: 100, max: 300 },
  requiresProductId: false,
};
