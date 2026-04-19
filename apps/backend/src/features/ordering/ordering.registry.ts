import { getServiceClient } from '../../shared/database/supabase.js';
import { createLogger } from '../../shared/services/logger.service.js';
import type { IOrderHandler } from './ordering.types.js';

const log = createLogger('OrderingRegistry');

import { BarryGroupOrderHandler } from './handlers/barry-group/barry-group.order-handler.js';
// Import order handlers (will be implemented next)
import { MusgraveOrderHandler } from './handlers/musgrave/musgrave.order-handler.js';
import { OreillysOrderHandler } from './handlers/oreillys/oreillys.order-handler.js';
import { SavageWhittenOrderHandler } from './handlers/savage-whitten/savage-whitten.order-handler.js';

/**
 * Registry for order handlers.
 * Maps supplier ID to handler instance.
 */
class OrderingRegistry {
  private handlers: Map<string, IOrderHandler> = new Map();
  private initialized = false;

  /**
   * Initialize the registry by loading supplier IDs from the database.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    log.info('Initializing');

    // Create handler instances
    const allHandlers: IOrderHandler[] = [
      new MusgraveOrderHandler(),
      new BarryGroupOrderHandler(),
      new OreillysOrderHandler(),
      new SavageWhittenOrderHandler(),
    ];

    // Fetch active suppliers from database
    const supabase = getServiceClient();
    const { data: suppliers, error } = await supabase
      .from('suppliers')
      .select('id, name')
      .eq('is_active', true);

    if (error) {
      log.error({ errorMessage: error.message }, 'Failed to load suppliers');
      throw new Error(`Failed to load suppliers: ${error.message}`);
    }

    if (!suppliers || suppliers.length === 0) {
      log.warn('No active suppliers found');
      this.initialized = true;
      return;
    }

    // Create lookup map: supplier name -> supplier id
    const supplierMap = new Map<string, string>(
      suppliers.map((s: { id: string; name: string }) => [s.name.toLowerCase(), s.id])
    );

    // Register handlers that match database suppliers
    for (const handler of allHandlers) {
      const supplierId = supplierMap.get(handler.supplierName.toLowerCase());

      if (!supplierId) {
        log.warn(
          { supplierName: handler.supplierName },
          'Supplier not found in database - skipping'
        );
        continue;
      }

      handler.supplierId = supplierId;
      this.handlers.set(supplierId, handler);
      log.debug({ name: handler.name, supplierId }, 'Handler registered');
    }

    this.initialized = true;
    log.info({ count: this.handlers.size }, 'Initialization complete');
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('[OrderingRegistry] Not initialized. Call initialize() first.');
    }
  }

  get(supplierId: string): IOrderHandler | undefined {
    this.ensureInitialized();
    return this.handlers.get(supplierId);
  }

  getAll(): IOrderHandler[] {
    this.ensureInitialized();
    return Array.from(this.handlers.values());
  }

  has(supplierId: string): boolean {
    this.ensureInitialized();
    return this.handlers.has(supplierId);
  }

  get count(): number {
    this.ensureInitialized();
    return this.handlers.size;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }
}

// Singleton instance
export const orderingRegistry = new OrderingRegistry();

// Helper functions
export function getOrderHandler(supplierId: string): IOrderHandler | undefined {
  return orderingRegistry.get(supplierId);
}

export function getAllOrderHandlers(): IOrderHandler[] {
  return orderingRegistry.getAll();
}

export async function initOrderingRegistry(): Promise<void> {
  await orderingRegistry.initialize();
}
