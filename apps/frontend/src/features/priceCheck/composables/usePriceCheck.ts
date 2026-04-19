/**
 * Price Check Composable
 *
 * Singleton state + actions for the price-check feature.
 * All pricing logic (ranking, threshold, requires_user_pick) lives in the
 * backend. This composable is presentation-only: it holds the last server
 * response, tracks which suppliers the user hid, and re-POSTs /compare
 * whenever that set changes. No local re-evaluation.
 */

import { computed, ref } from 'vue'
import { comparePrices, uploadAndCompare } from '../api/mutations'
import type {
 ComparisonSummary,
 PriceCheckApiResponse,
 SupplierRanking,
} from '../types'
import { useOrderSubmission } from './useOrderSubmission'

/**
 * Minimal shape the backend `/compare` accepts. Mirrors the XLS parse output
 * that the server sent back in the initial upload-and-compare response.
 */
interface ParsedOrderItem {
 article_code: string
 quantity: number
 unit_cost: number
}

// Shared state (module-level singleton)
const isLoading = ref(false)
const error = ref<string | null>(null)
const selectedFile = ref<File | null>(null)
const result = ref<PriceCheckApiResponse['data'] | null>(null)
// Record (not Set) for Vue reactivity
const hiddenSupplierIds = ref<Record<string, boolean>>({})
// Kept so we can call /compare again on supplier toggle without re-uploading
const lastItems = ref<ParsedOrderItem[] | null>(null)
const lastCompanyId = ref<string>('')

export function usePriceCheck() {
 const { selections } = useOrderSubmission()

 const allSuppliers = computed(() => result.value?.comparison?.suppliers ?? [])
 const activeSuppliers = computed(() =>
  allSuppliers.value.filter((s) => !hiddenSupplierIds.value[s.id]),
 )

 /** supplier_id → declared ordering constraints (from backend). */
 const supplierConstraints = computed(
  () => result.value?.comparison?.supplier_constraints ?? {},
 )

 // Products + evaluation come from backend as-is. No local recompute.
 const products = computed(() => result.value?.comparison?.products ?? [])

 const hasResults = computed(() => result.value !== null)
 const parseResult = computed(() => result.value?.parse_result ?? null)
 const totalProductsCount = computed(() => products.value.length)
 const selectedProductsCount = computed(() => selections.value.size)

 /**
  * Selection-based summary. Uses user selections (not threshold evaluation)
  * to decide which supplier each product counts against. Unselected products
  * fall into a "Local Order" baseline row.
  */
 const summary = computed((): ComparisonSummary | null => {
  if (!result.value?.comparison) return null
  const originalSummary = result.value.comparison.summary
  const currentProducts = products.value
  const currentSelections = selections.value
  const activeSup = activeSuppliers.value

  const supplierStats = new Map<
   string,
   {
    products_won: number
    won_products_order_cost: number
    won_products_supplier_cost: number
    total_cost_if_all_from_here: number
   }
  >()
  for (const supplier of activeSup) {
   supplierStats.set(supplier.id, {
    products_won: 0,
    won_products_order_cost: 0,
    won_products_supplier_cost: 0,
    total_cost_if_all_from_here: 0,
   })
  }

  let localOrderCount = 0
  let localOrderCost = 0

  for (const product of currentProducts) {
   const selection = currentSelections.get(product.product_id)

   for (const supplier of activeSup) {
    const prices = product.supplier_prices[supplier.id]
    if (prices && prices.length > 0 && prices[0]) {
     const stats = supplierStats.get(supplier.id)
     if (stats) stats.total_cost_if_all_from_here += prices[0].unit_price * product.order.quantity
    }
   }

   if (selection) {
    const stats = supplierStats.get(selection.supplier_id)
    if (stats) {
     stats.products_won++
     stats.won_products_order_cost += product.order.line_cost
     stats.won_products_supplier_cost +=
      selection.supplier_unit_price * selection.quantity
    }
   } else {
    localOrderCount++
    localOrderCost += product.order.line_cost
   }
  }

  const newSupplierRankings: SupplierRanking[] = []
  for (const supplier of activeSup) {
   const stats = supplierStats.get(supplier.id)!
   const savingsOnWonProducts =
    stats.won_products_order_cost - stats.won_products_supplier_cost
   const savingsPercentage =
    stats.won_products_order_cost > 0
     ? (savingsOnWonProducts / stats.won_products_order_cost) * 100
     : 0
   newSupplierRankings.push({
    supplier_id: supplier.id,
    supplier_name: supplier.name,
    products_won: stats.products_won,
    total_cost_if_all_from_here: stats.total_cost_if_all_from_here,
    won_products_supplier_cost: stats.won_products_supplier_cost,
    won_products_order_cost: stats.won_products_order_cost,
    savings_on_won_products: savingsOnWonProducts,
    savings_percentage: savingsPercentage,
   })
  }
  newSupplierRankings.push({
   supplier_id: 'local_order',
   supplier_name: 'Local Order',
   products_won: localOrderCount,
   total_cost_if_all_from_here: originalSummary.order_totals.total_order_value,
   won_products_supplier_cost: localOrderCost,
   won_products_order_cost: localOrderCost,
   savings_on_won_products: 0,
   savings_percentage: 0,
  })

  const totalSavings = newSupplierRankings
   .filter((s) => s.supplier_id !== 'local_order')
   .reduce((sum, s) => sum + s.savings_on_won_products, 0)
  const productsFromSuppliers = currentProducts.length - localOrderCount

  return {
   counts: originalSummary.counts,
   order_totals: originalSummary.order_totals,
   evaluation_results: {
    products_order_is_best: localOrderCount,
    products_supplier_is_best: productsFromSuppliers,
    products_below_threshold: 0,
    max_potential_savings: totalSavings,
    recommendation: 'mixed',
    best_overall: null,
   },
   supplier_rankings: newSupplierRankings,
   thresholds_applied: originalSummary.thresholds_applied,
  }
 })

 /** Upload an XLS file and run the first comparison. */
 async function checkPrices(file: File, _locationId: string, companyId: string) {
  isLoading.value = true
  error.value = null
  selectedFile.value = file

  try {
   const response = await uploadAndCompare(file, _locationId, companyId)
   if (!response.success) {
    error.value = response.error || 'Failed to check prices'
    return false
   }
   result.value = response.data ?? null
   lastItems.value =
    (response.data?.parse_result.items as ParsedOrderItem[] | undefined) ?? null
   lastCompanyId.value = companyId
   return true
  } catch (err) {
   error.value = err instanceof Error ? err.message : 'An unexpected error occurred'
   return false
  } finally {
   isLoading.value = false
  }
 }

 /**
  * Re-run /compare with the current visible-supplier filter. The backend is
  * the single source of ranking truth; this function just forwards user
  * intent (hidden set) and replaces the comparison in state.
  */
 async function recompareWithCurrentFilter() {
  if (!lastItems.value || !lastCompanyId.value || !result.value) return
  const visibleIds = allSuppliers.value
   .filter((s) => !hiddenSupplierIds.value[s.id])
   .map((s) => s.id)
  // Send only the fields Zod expects on the backend
  const payload = lastItems.value.map((i) => ({
   article_code: i.article_code,
   quantity: i.quantity,
   unit_cost: i.unit_cost,
  }))
  isLoading.value = true
  try {
   const res = await comparePrices(payload, lastCompanyId.value, visibleIds)
   if (!res.success || !res.data) {
    error.value = res.error || 'Failed to update comparison'
    return
   }
   result.value = { ...result.value, comparison: res.data }
  } catch (err) {
   error.value = err instanceof Error ? err.message : 'An unexpected error occurred'
  } finally {
   isLoading.value = false
  }
 }

 async function toggleSupplier(id: string) {
  if (hiddenSupplierIds.value[id]) delete hiddenSupplierIds.value[id]
  else hiddenSupplierIds.value[id] = true
  hiddenSupplierIds.value = { ...hiddenSupplierIds.value }
  await recompareWithCurrentFilter()
 }

 function isSupplierHidden(id: string): boolean {
  return !!hiddenSupplierIds.value[id]
 }

 function clearResults() {
  result.value = null
  error.value = null
  selectedFile.value = null
  hiddenSupplierIds.value = {}
  lastItems.value = null
  lastCompanyId.value = ''
 }

 function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IE', {
   style: 'currency',
   currency: 'EUR',
  }).format(value)
 }

 function formatPercentage(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
 }

 function getSupplierName(supplierId: string): string {
  return activeSuppliers.value.find((s) => s.id === supplierId)?.name ?? 'Unknown'
 }

 return {
  // State
  isLoading,
  error,
  selectedFile,
  result,
  // Computed
  hasResults,
  suppliers: activeSuppliers,
  allSuppliers,
  supplierConstraints,
  products,
  summary,
  parseResult,
  selectedProductsCount,
  totalProductsCount,
  // Actions
  checkPrices,
  clearResults,
  toggleSupplier,
  // Helpers
  formatCurrency,
  formatPercentage,
  getSupplierName,
  isSupplierHidden,
 }
}
