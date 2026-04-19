/**
 * Order Submission Composable
 *
 * Manages product selection and order submission state
 * Uses singleton pattern - state is shared across all component instances
 */

import type { SupplierConstraint } from '@pricectrl/contracts/priceCheck';
import { computed, ref } from 'vue';
import { submitOrder } from '../api/orderSubmission';
import type {
  LocationOption,
  OrderSubmitResponseData,
  ProductComparison,
  ProductSelection,
  Supplier,
  SupplierPrice,
} from '../types';
import {
  buildOrderPayload,
  calculateTotalSavings,
  groupSelectionsBySupplier,
  validateSelections,
} from '../utils/orderBuilder';

// Singleton state (defined outside the function)
const selections = ref<Map<string, ProductSelection>>(new Map());
const isSubmitting = ref(false);
const submitResult = ref<OrderSubmitResponseData | null>(null);
const submitError = ref<string | null>(null);
const showSubmitDialog = ref(false);
const showResultsDialog = ref(false);
const selectedLocation = ref<LocationOption | null>(null);

export function useOrderSubmission() {
  // === COMPUTED ===

  const hasSelections = computed(() => selections.value.size > 0);

  const totalSelectedItems = computed(() => selections.value.size);

  const totalEstimatedSavings = computed(() =>
    calculateTotalSavings(Array.from(selections.value.values()))
  );

  const selectionsBySupplier = computed(() =>
    groupSelectionsBySupplier(Array.from(selections.value.values()))
  );

  const selectedSupplierCount = computed(() => selectionsBySupplier.value.size);

  const selectionsArray = computed(() => Array.from(selections.value.values()));

  // === SELECTION ACTIONS ===

  /**
   * Check if product is selected (any supplier)
   */
  function isProductSelected(productId: string): boolean {
    return selections.value.has(productId);
  }

  /**
   * Get selected supplier for a product
   */
  function getSelectedSupplier(productId: string): string | null {
    return selections.value.get(productId)?.supplier_id ?? null;
  }

  /**
   * Check if specific supplier is selected for a product
   */
  function isSupplierSelectedForProduct(productId: string, supplierId: string): boolean {
    const selection = selections.value.get(productId);
    return selection?.supplier_id === supplierId;
  }

  /**
   * Toggle selection for a product
   * Auto-deselects other suppliers for same product
   */
  function toggleSelection(
    product: ProductComparison,
    supplier: Supplier,
    price: SupplierPrice
  ): void {
    const key = product.product_id;
    const existing = selections.value.get(key);

    // If clicking same supplier, deselect
    if (existing?.supplier_id === supplier.id) {
      selections.value.delete(key);
    } else {
      // Select this supplier (replaces any previous selection)
      const selection: ProductSelection = {
        product_id: product.product_id,
        article_code: product.article_code,
        description: product.description,
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        supplier_product_code: price.supplier_product_code,
        quantity: product.order.quantity,
        order_unit_price: product.order.unit_cost,
        supplier_unit_price: price.unit_price,
        savings: (product.order.unit_cost - price.unit_price) * product.order.quantity,
        internal_product_id: price.internal_product_id,
      };
      selections.value.set(key, selection);
    }
    // Trigger reactivity
    selections.value = new Map(selections.value);
  }

  /**
   * Select all best prices (where supplier beats order)
   */
  function selectAllBestPrices(products: ProductComparison[], suppliers: Supplier[]): void {
    for (const product of products) {
      // Only select if supplier is best (not order)
      if (!product.evaluation.order_is_best && product.evaluation.winning_supplier_id) {
        const supplier = suppliers.find((s) => s.id === product.evaluation.winning_supplier_id);
        const prices = product.supplier_prices[product.evaluation.winning_supplier_id];
        const price = prices?.[0];

        if (supplier && price) {
          const selection: ProductSelection = {
            product_id: product.product_id,
            article_code: product.article_code,
            description: product.description,
            supplier_id: supplier.id,
            supplier_name: supplier.name,
            supplier_product_code: price.supplier_product_code,
            quantity: product.order.quantity,
            order_unit_price: product.order.unit_cost,
            supplier_unit_price: price.unit_price,
            savings: product.evaluation.potential_savings ?? 0,
            internal_product_id: price.internal_product_id,
          };
          selections.value.set(product.product_id, selection);
        }
      }
    }
    selections.value = new Map(selections.value);
  }

  /**
   * Clear all selections
   */
  function clearSelections(): void {
    selections.value.clear();
    selections.value = new Map(selections.value);
  }

  // === VALIDATION ===

  /**
   * Validate selections before submission. Constraints come from the
   * backend /compare response (supplier_constraints) — no name matching.
   */
  function validate(constraints: Record<string, SupplierConstraint>) {
    return validateSelections(Array.from(selections.value.values()), constraints);
  }

  // === SUBMISSION ===

  /**
   * Submit orders to suppliers
   */
  async function submit(companyId: string, locationId: string): Promise<boolean> {
    if (selections.value.size === 0) return false;

    isSubmitting.value = true;
    submitError.value = null;
    submitResult.value = null;

    try {
      const payload = buildOrderPayload(
        Array.from(selections.value.values()),
        companyId,
        locationId
      );

      const response = await submitOrder(payload);

      // Always populate submitResult when the backend returned per-supplier data,
      // even if some suppliers failed. This lets the results dialog show partial
      // successes instead of a generic error message.
      if (response.data) {
        submitResult.value = response.data;
        return true; // open the results dialog which handles partial success
      }

      // No data at all — true network failure (timeout, connection refused, etc.)
      submitError.value = response.error || 'Failed to submit order';
      return false;
    } catch (err) {
      submitError.value = err instanceof Error ? err.message : 'Unexpected error';
      return false;
    } finally {
      isSubmitting.value = false;
    }
  }

  /**
   * Open supplier baskets in new tabs
   */
  function openBaskets(): void {
    if (!submitResult.value) return;

    for (const result of submitResult.value.results) {
      if (result.success || result.items_added > 0) {
        window.open(result.basket_url, '_blank');
      }
    }
  }

  /**
   * Open a single supplier basket
   */
  function openBasket(basketUrl: string): void {
    window.open(basketUrl, '_blank');
  }

  // === DIALOG CONTROLS ===

  function openSubmitDialog(): void {
    showSubmitDialog.value = true;
  }

  function closeSubmitDialog(): void {
    showSubmitDialog.value = false;
  }

  function openResultsDialog(): void {
    showResultsDialog.value = true;
  }

  function closeResultsDialog(): void {
    showResultsDialog.value = false;
  }

  // === LOCATION ===

  function setSelectedLocation(location: LocationOption | null): void {
    selectedLocation.value = location;
  }

  // === RESET ===

  /**
   * Reset all state (call when starting new price check)
   */
  function reset(): void {
    clearSelections();
    submitResult.value = null;
    submitError.value = null;
    showSubmitDialog.value = false;
    showResultsDialog.value = false;
    selectedLocation.value = null;
  }

  return {
    // State
    selections,
    isSubmitting,
    submitResult,
    submitError,
    showSubmitDialog,
    showResultsDialog,
    selectedLocation,

    // Computed
    hasSelections,
    totalSelectedItems,
    totalEstimatedSavings,
    selectionsBySupplier,
    selectedSupplierCount,
    selectionsArray,

    // Selection actions
    isProductSelected,
    getSelectedSupplier,
    isSupplierSelectedForProduct,
    toggleSelection,
    selectAllBestPrices,
    clearSelections,

    // Validation
    validate,

    // Submission
    submit,
    openBaskets,
    openBasket,

    // Dialog controls
    openSubmitDialog,
    closeSubmitDialog,
    openResultsDialog,
    closeResultsDialog,

    // Location
    setSelectedLocation,

    // Reset
    reset,
  };
}
