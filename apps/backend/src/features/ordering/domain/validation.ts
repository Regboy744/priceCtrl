/**
 * Submission validation — pure domain logic.
 *
 * Given an order-submission request and the current per-supplier
 * constraints (declared via each supplier's `OrderHandlerConfig`),
 * return a list of structured warnings/errors. Callers decide how to
 * react: the HTTP controller logs them and attaches to the response,
 * the UI surfaces them pre-flight.
 *
 * Pure function — no HTTP, DB, registry, or env access. Inputs fully
 * describe what the rules need, so every rule is unit-testable in
 * isolation and the same function can be called from any entry point
 * (submit endpoint, pre-flight validate endpoint, admin tools).
 */

import type {
  SupplierConstraint,
  ValidationWarning,
} from '@pricectrl/contracts/priceCheck';
import type { OrderSubmissionRequest } from '../ordering.types.js';

export interface ValidationInputs {
  request: OrderSubmissionRequest;
  /** supplier_id → constraint. Missing entries imply no extra rules. */
  constraints: Map<string, SupplierConstraint>;
}

/**
 * Run all declared rules and collect warnings. Rules today are soft —
 * they document problems without blocking submission. Future work may
 * promote specific `severity: 'error'` codes to hard rejection.
 */
export function validateSubmission(inputs: ValidationInputs): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  for (const supplierOrder of inputs.request.supplier_orders) {
    const constraint = inputs.constraints.get(supplierOrder.supplier_id);
    if (!constraint) continue;

    if (constraint.requires_internal_product_id) {
      const missing = supplierOrder.items.filter((i) => !i.product_id);
      if (missing.length > 0) {
        warnings.push({
          code: 'missing_internal_product_id',
          severity: 'error',
          message: `${missing.length} item(s) missing internal product_id; supplier will reject them.`,
          supplier_id: supplierOrder.supplier_id,
          item_count: missing.length,
        });
      }
    }
  }

  return warnings;
}
