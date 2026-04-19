/**
 * Order Builder Utility
 *
 * Transforms product selections into the submission payload. Validation
 * is driven by `supplier_constraints` that the backend attaches to
 * the /compare response — no hardcoded supplier names, no fragile string
 * matching. When the backend declares a new rule, the frontend picks it
 * up automatically.
 */

import type {
 SupplierConstraint,
 ValidationWarning,
} from '@pricectrl/contracts/priceCheck'
import type {
 ProductSelection,
 OrderSubmitRequest,
 SupplierOrderRequest,
 OrderItemRequest,
} from '../types'

/**
 * Build order submission payload from selections
 * Groups items by supplier_id
 */
export function buildOrderPayload(
 selections: ProductSelection[],
 companyId: string,
 locationId: string,
): OrderSubmitRequest {
 // Group by supplier
 const supplierMap = new Map<string, OrderItemRequest[]>()

 for (const selection of selections) {
  const items = supplierMap.get(selection.supplier_id) || []

  const item: OrderItemRequest = {
   supplier_product_code: selection.supplier_product_code,
   quantity: selection.quantity,
   product_name: selection.description,
   // Fields for database persistence
   master_product_id: selection.product_id,
   unit_price: selection.supplier_unit_price,
   baseline_unit_price: selection.order_unit_price,
  }

  // Add internal_product_id if available (required for S&W)
  if (selection.internal_product_id) {
   item.product_id = selection.internal_product_id
  }

  items.push(item)
  supplierMap.set(selection.supplier_id, items)
 }

 // Convert to supplier_orders array
 const supplier_orders: SupplierOrderRequest[] = Array.from(
  supplierMap.entries(),
 ).map(([supplier_id, items]) => ({
  supplier_id,
  items,
 }))

 return {
  company_id: companyId,
  location_id: locationId,
  supplier_orders,
 }
}

/**
 * Validation result for selections
 */
export interface ValidationResult {
 valid: boolean
 warnings: ValidationWarning[]
}

/**
 * Evaluate the selections against the backend-declared supplier constraints.
 * No name matching — `constraints[supplier_id].requires_internal_product_id`
 * comes straight from the ordering handler's config via the /compare
 * response, so adding a new rule is a backend-only change.
 */
export function validateSelections(
 selections: ProductSelection[],
 constraints: Record<string, SupplierConstraint>,
): ValidationResult {
 const warnings: ValidationWarning[] = []

 // Group counts of "missing internal_product_id" selections per supplier.
 const missingBySupplier = new Map<string, number>()
 for (const selection of selections) {
  if (selection.internal_product_id) continue
  const constraint = constraints[selection.supplier_id]
  if (!constraint?.requires_internal_product_id) continue
  missingBySupplier.set(
   selection.supplier_id,
   (missingBySupplier.get(selection.supplier_id) ?? 0) + 1,
  )
 }
 for (const [supplierId, count] of missingBySupplier) {
  const supplierName =
   selections.find((s) => s.supplier_id === supplierId)?.supplier_name ?? 'supplier'
  warnings.push({
   code: 'missing_internal_product_id',
   severity: 'error',
   message: `${count} ${supplierName} item(s) are missing internal product ID and may fail to submit.`,
   supplier_id: supplierId,
   item_count: count,
  })
 }

 return {
  valid: warnings.length === 0,
  warnings,
 }
}

/**
 * Group selections by supplier for display
 */
export function groupSelectionsBySupplier(
 selections: ProductSelection[],
): Map<string, ProductSelection[]> {
 const grouped = new Map<string, ProductSelection[]>()

 for (const selection of selections) {
  const list = grouped.get(selection.supplier_id) || []
  list.push(selection)
  grouped.set(selection.supplier_id, list)
 }

 return grouped
}

/**
 * Calculate total savings from selections
 */
export function calculateTotalSavings(selections: ProductSelection[]): number {
 return selections.reduce((total, selection) => total + selection.savings, 0)
}

/**
 * Calculate total supplier cost from selections
 */
export function calculateTotalSupplierCost(
 selections: ProductSelection[],
): number {
 return selections.reduce(
  (total, selection) =>
   total + selection.supplier_unit_price * selection.quantity,
  0,
 )
}

/**
 * Calculate total order cost (baseline) from selections
 */
export function calculateTotalOrderCost(
 selections: ProductSelection[],
): number {
 return selections.reduce(
  (total, selection) => total + selection.order_unit_price * selection.quantity,
  0,
 )
}
