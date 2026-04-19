/**
 * Price Check Service
 *
 * Business logic for comparing prices across suppliers.
 */

import { env } from '../../shared/config/env.js';
import { getServiceClient } from '../../shared/database/supabase.js';
import { createLogger } from '../../shared/services/logger.service.js';
import { getAllOrderHandlers } from '../ordering/ordering.registry.js';
import { type SupplierCandidate, computeProductEvaluation } from './domain/ranking.js';
import type {
  OrderItem,
  PriceCheckResponse,
  PriceCheckSummary,
  PricingComparisonRow,
  ProductComparison,
  SupplierConstraint,
  SupplierInfo,
  SupplierPrice,
  SupplierRanking,
} from './priceCheck.types.js';

const supabase = getServiceClient();
const log = createLogger('PriceCheckService');

/**
 * Result of EAN-based product lookup
 */
interface ProductLookupResult {
  /** Article codes not found in master_products */
  notFound: string[];
  /** All product IDs to query (including EAN variants) */
  productIds: string[];
  /** Map: EAN code → original article code (for order info lookup) */
  eanToOriginalArticle: Map<string, string>;
  /** Map: product_id → article_code (for all found products including variants) */
  productIdToArticle: Map<string, string>;
  /** Map: article_code → product_id (for original ordered items only) */
  articleCodeToProductId: Map<string, string>;
}

/**
 * Look up master products by article codes using EAN-based matching
 *
 * Flow:
 * 1. Find master_products by exact article_code match → get their EANs
 * 2. Find ALL master_products with those EANs (includes pack size variants)
 * 3. Return all matching product IDs for price comparison
 *
 * @param articleCodes - Array of transformed article codes (e.g., "1483944 000")
 * @returns ProductLookupResult with all matching products and mappings
 */
export async function lookupProductsByEan(articleCodes: string[]): Promise<ProductLookupResult> {
  const notFound: string[] = [];
  const eanToOriginalArticle = new Map<string, string>();
  const productIdToArticle = new Map<string, string>();
  const articleCodeToProductId = new Map<string, string>();

  if (articleCodes.length === 0) {
    return {
      notFound,
      productIds: [],
      eanToOriginalArticle,
      productIdToArticle,
      articleCodeToProductId,
    };
  }

  // Step 1: Find exact article_code matches and get their EANs
  const { data: exactMatches, error: exactError } = await supabase
    .from('master_products')
    .select('id, article_code, ean_code')
    .in('article_code', articleCodes)
    .eq('is_active', true)
    .returns<{ id: string; article_code: string; ean_code: string }[]>();

  if (exactError) {
    log.error({ err: exactError }, 'Error looking up products');
    throw new Error(`Database error: ${exactError.message}`);
  }

  // Track found article codes and collect EANs
  const foundArticleCodes = new Set<string>();
  const eanCodes = new Set<string>();

  for (const row of exactMatches ?? []) {
    foundArticleCodes.add(row.article_code);
    // Map article code to its product_id (for original ordered items)
    articleCodeToProductId.set(row.article_code, row.id);
    if (row.ean_code) {
      eanCodes.add(row.ean_code);
      // Map EAN back to original article code for order info lookup
      eanToOriginalArticle.set(row.ean_code, row.article_code);
    }
  }

  // Identify not found codes
  for (const code of articleCodes) {
    if (!foundArticleCodes.has(code)) {
      notFound.push(code);
    }
  }

  if (eanCodes.size === 0) {
    return {
      notFound,
      productIds: [],
      eanToOriginalArticle,
      productIdToArticle,
      articleCodeToProductId,
    };
  }

  // Step 2: Find ALL products with those EANs (including pack size variants)
  const { data: eanMatches, error: eanError } = await supabase
    .from('master_products')
    .select('id, article_code, ean_code')
    .in('ean_code', Array.from(eanCodes))
    .eq('is_active', true)
    .returns<{ id: string; article_code: string; ean_code: string }[]>();

  if (eanError) {
    log.error({ err: eanError }, 'Error looking up EAN matches');
    throw new Error(`Database error: ${eanError.message}`);
  }

  // Collect all product IDs and build article code mapping
  const productIds: string[] = [];
  for (const row of eanMatches ?? []) {
    productIds.push(row.id);
    productIdToArticle.set(row.id, row.article_code);
  }

  return { notFound, productIds, eanToOriginalArticle, productIdToArticle, articleCodeToProductId };
}

/**
 * Supplier configured for price comparison by a company.
 * The canonical list of suppliers the UI should render — even when a given
 * supplier has zero matching prices for the current order. Drives column
 * toggle UX; the filter controls `supplier_prices`, never `suppliers`.
 */
interface CompanySupplierConfig {
  id: string;
  name: string;
  is_active: boolean;
  threshold_percentage: number;
}

/**
 * Read per-supplier ordering constraints from the order-handler registry.
 * The UI consumes this map to render pre-flight warnings (e.g. "this
 * supplier needs internal_product_id"). Safe before registry is
 * initialized — returns an empty map.
 */
function getSupplierConstraints(): Record<string, SupplierConstraint> {
  const constraints: Record<string, SupplierConstraint> = {};
  let handlers: ReturnType<typeof getAllOrderHandlers> = [];
  try {
    handlers = getAllOrderHandlers();
  } catch {
    // Registry not initialized yet — no constraints available.
    return constraints;
  }
  for (const handler of handlers) {
    constraints[handler.supplierId] = {
      requires_internal_product_id: handler.config.requiresProductId,
      max_items_per_request: handler.config.maxItemsPerRequest,
    };
  }
  return constraints;
}

async function getCompanyConfiguredSuppliers(companyId: string): Promise<CompanySupplierConfig[]> {
  const [thresholdsRes, suppliersRes] = await Promise.all([
    supabase
      .from('company_supplier_settings')
      .select('supplier_id, threshold_percentage')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .returns<{ supplier_id: string; threshold_percentage: number }[]>(),
    supabase
      .from('suppliers')
      .select('id, name, is_active')
      .eq('is_active', true)
      .returns<{ id: string; name: string; is_active: boolean }[]>(),
  ]);

  if (suppliersRes.error) {
    log.error({ companyId, err: suppliersRes.error }, 'Error fetching suppliers');
    return [];
  }
  if (thresholdsRes.error) {
    log.warn(
      { companyId, err: thresholdsRes.error },
      'Error fetching thresholds; defaulting to 0%'
    );
  }

  // Thresholds are overrides; absence means "use 0%", not "exclude supplier".
  // Canonical list = all active suppliers — keeps column toggle UX stable
  // even for companies that haven't been explicitly configured.
  const thresholdBySupplier = new Map(
    (thresholdsRes.data ?? []).map((r) => [r.supplier_id, Number(r.threshold_percentage)])
  );

  return (suppliersRes.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    is_active: s.is_active,
    threshold_percentage: thresholdBySupplier.get(s.id) ?? 0,
  }));
}

/**
 * Call the get_pricing_comparison RPC function
 * Uses direct fetch because the RPC is not in generated TypeScript types
 */
async function callPricingComparisonRpc(params: {
  companyId: string;
  productIds: string[];
  supplierIds?: string[];
  includeUnavailable: boolean;
}): Promise<PricingComparisonRow[]> {
  const { companyId, productIds, supplierIds, includeUnavailable } = params;

  const response = await fetch(`${env.supabase.url}/rest/v1/rpc/get_pricing_comparison`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.supabase.serviceRoleKey,
      Authorization: `Bearer ${env.supabase.serviceRoleKey}`,
    },
    body: JSON.stringify({
      p_company_id: companyId,
      p_product_ids: productIds,
      p_supplier_ids: supplierIds ?? null,
      p_include_unavailable: includeUnavailable,
      p_limit: 10000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    log.error({ errorText }, 'RPC error');
    throw new Error(`Database RPC error: ${errorText}`);
  }

  return (await response.json()) as PricingComparisonRow[];
}

/**
 * Compare prices for a list of order items across all suppliers
 *
 * @param companyId - Company ID for special pricing lookup
 * @param items - Order items with article codes and quantities
 * @param supplierIds - Optional: filter to specific suppliers
 * @param includeUnavailable - Include unavailable products
 * @returns Price comparison response
 */
export async function comparePrices(
  companyId: string,
  items: OrderItem[],
  supplierIds?: string[],
  includeUnavailable = false
): Promise<PriceCheckResponse> {
  // Extract unique article codes
  const articleCodes = [...new Set(items.map((item) => item.article_code))];

  // Look up products using EAN-based matching
  const { notFound, productIds, eanToOriginalArticle, productIdToArticle, articleCodeToProductId } =
    await lookupProductsByEan(articleCodes);

  const totalOrderValue = items.reduce((sum, i) => sum + i.line_cost, 0);

  // Canonical supplier universe for this company. Drives UI columns;
  // stays stable across filter toggles so UI can re-add hidden suppliers.
  const configuredSuppliers = await getCompanyConfiguredSuppliers(companyId);
  const thresholds = new Map(configuredSuppliers.map((s) => [s.id, s.threshold_percentage]));

  if (productIds.length === 0) {
    return buildEmptyResponse(configuredSuppliers, thresholds, notFound, totalOrderValue);
  }

  const rows = await callPricingComparisonRpc({
    companyId,
    productIds,
    supplierIds,
    includeUnavailable,
  });

  return transformToResponse(
    rows,
    items,
    eanToOriginalArticle,
    articleCodeToProductId,
    notFound,
    totalOrderValue,
    thresholds,
    configuredSuppliers
  );
}

/**
 * Response when the uploaded items match zero master products. Keeps the
 * full supplier list / thresholds_used so the UI can still render columns.
 */
function buildEmptyResponse(
  configuredSuppliers: CompanySupplierConfig[],
  thresholds: Map<string, number>,
  notFound: string[],
  totalOrderValue: number
): PriceCheckResponse {
  const supplierInfos: SupplierInfo[] = configuredSuppliers.map((s) => ({
    id: s.id,
    name: s.name,
    is_active: s.is_active,
  }));
  const thresholdsUsed: Record<string, { supplier_name: string; percentage: number }> = {};
  for (const s of configuredSuppliers) {
    thresholdsUsed[s.id] = { supplier_name: s.name, percentage: s.threshold_percentage };
  }
  const emptyRankings: SupplierRanking[] = configuredSuppliers.map((s) => ({
    supplier_id: s.id,
    supplier_name: s.name,
    products_won: 0,
    total_cost_if_all_from_here: 0,
    won_products_supplier_cost: 0,
    won_products_order_cost: 0,
    savings_on_won_products: 0,
    savings_percentage: 0,
  }));

  return {
    data_category: 'price_comparison',
    description:
      'All comparisons use threshold logic. Set threshold to 0 for raw price comparison.',
    thresholds_used: thresholdsUsed,
    suppliers: supplierInfos,
    supplier_constraints: getSupplierConstraints(),
    products: [],
    summary: {
      counts: {
        total_items_submitted: notFound.length,
        products_found: 0,
        products_not_found: notFound,
        products_unpriced: [],
        suppliers_compared: configuredSuppliers.length,
      },
      order_totals: {
        total_order_value: Number(totalOrderValue.toFixed(2)),
        matched_order_value: 0,
      },
      evaluation_results: {
        products_order_is_best: 0,
        products_supplier_is_best: 0,
        products_below_threshold: 0,
        max_potential_savings: null,
        recommendation: 'keep_order',
        best_overall: null,
      },
      supplier_rankings: emptyRankings,
      thresholds_applied: Object.fromEntries(thresholds),
    },
  };
}

/**
 * Transform RPC results to response format with calculated totals
 */
function transformToResponse(
  rows: PricingComparisonRow[],
  orderItems: OrderItem[],
  eanToOriginalArticle: Map<string, string>,
  articleCodeToProductId: Map<string, string>,
  notFoundCodes: string[],
  totalOrderValue: number,
  thresholds: Map<string, number>,
  configuredSuppliers: CompanySupplierConfig[]
): PriceCheckResponse {
  // Build order lookup by article code
  const orderByArticle = new Map<string, OrderItem>();
  for (const item of orderItems) {
    orderByArticle.set(item.article_code, item);
  }

  // Seed supplier universe from the company's configured list so the UI
  // gets a stable column set even when a filter or zero matches leave
  // a supplier without rows. Rows then fill in actual prices.
  const suppliersMap = new Map<string, SupplierInfo>();
  const thresholdsUsed: Record<string, { supplier_name: string; percentage: number }> = {};

  for (const s of configuredSuppliers) {
    suppliersMap.set(s.id, { id: s.id, name: s.name, is_active: s.is_active });
    thresholdsUsed[s.id] = { supplier_name: s.name, percentage: s.threshold_percentage };
  }
  // Defensive: any supplier that appears in rows but isn't in the
  // configured set still gets surfaced (shouldn't normally happen).
  for (const row of rows) {
    if (!suppliersMap.has(row.supplier_id)) {
      suppliersMap.set(row.supplier_id, {
        id: row.supplier_id,
        name: row.supplier_name,
        is_active: row.is_active,
      });
      thresholdsUsed[row.supplier_id] = {
        supplier_name: row.supplier_name,
        percentage: thresholds.get(row.supplier_id) ?? 0,
      };
    }
  }
  const suppliers = Array.from(suppliersMap.values());

  // Track supplier totals (internal tracking for calculations)
  const supplierTotalsMap = new Map<
    string,
    {
      supplier_id: string;
      supplier_name: string;
      total_cost: number;
      products_available: number;
    }
  >();

  // Initialize supplier totals
  for (const supplier of suppliers) {
    supplierTotalsMap.set(supplier.id, {
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      total_cost: 0,
      products_available: 0,
    });
  }

  // Group prices by product - using internal structure first
  interface InternalProductData {
    product_id: string;
    article_code: string;
    description: string;
    ean_code: string;
    unit_size: string | null;
    order: { quantity: number; unit_cost: number; line_cost: number };
    prices: Record<string, SupplierPrice[]>;
  }

  const productsMap = new Map<string, InternalProductData>();

  for (const row of rows) {
    // Use EAN to find the original article code for order info lookup
    const originalArticleCode = eanToOriginalArticle.get(row.ean_code ?? '');
    if (!originalArticleCode) continue;

    const orderItem = orderByArticle.get(originalArticleCode);
    const quantity = orderItem?.quantity ?? 0;

    // Group by original ordered article code, not by product_id
    // This ensures we get one entry per order item, even when multiple
    // article codes share the same EAN
    let product = productsMap.get(originalArticleCode);

    if (!product) {
      // Get the product_id for the original ordered article code
      const originalProductId = articleCodeToProductId.get(originalArticleCode) ?? row.product_id;

      // Only use row data if it matches the original article code
      // Otherwise use data from the order item
      const useRowData = row.article_code === originalArticleCode;

      product = {
        product_id: originalProductId,
        article_code: originalArticleCode,
        description: useRowData ? row.description : `Product ${originalArticleCode}`,
        ean_code: row.ean_code ?? '',
        unit_size: useRowData ? (row.unit_size ?? null) : null,
        order: orderItem
          ? {
              quantity: orderItem.quantity,
              unit_cost: orderItem.unit_cost,
              line_cost: orderItem.line_cost,
            }
          : { quantity: 0, unit_cost: 0, line_cost: 0 },
        prices: {},
      };
      productsMap.set(originalArticleCode, product);
    }

    // Update description and unit_size if this row matches the original article code
    // (in case we created the entry with a variant row first)
    if (row.article_code === originalArticleCode) {
      product.description = row.description;
      product.unit_size = row.unit_size ?? null;
    }

    // Calculate line total for this supplier
    const unitPrice = Number(row.final_price);
    const lineTotal = Number((unitPrice * quantity).toFixed(2));
    const differenceVsOrder = Number((lineTotal - (orderItem?.line_cost ?? 0)).toFixed(2));

    // Add supplier price with calculated totals
    const price: SupplierPrice = {
      unit_price: unitPrice,
      catalog_price: Number(row.catalog_price),
      line_total: lineTotal,
      is_special_price: row.is_special_price,
      special_price_notes: row.special_price_notes,
      valid_until: row.valid_until,
      availability_status: row.availability_status,
      difference_vs_order: differenceVsOrder,
      supplier_product_code: row.supplier_product_code,
      internal_product_id: row.internal_product_id ?? null,
      // Pack metadata — new fields from the pricing RPC. Null when the
      // scraper couldn't extract (graceful fallback handled downstream).
      unit_cost_incl_vat: row.unit_cost_incl_vat ?? null,
      pack_count: row.pack_count ?? null,
      pack_unit_size: row.pack_unit_size ?? null,
    };

    // Push to array instead of overwriting (supports multiple pack sizes per supplier)
    if (!product.prices[row.supplier_id]) {
      product.prices[row.supplier_id] = [];
    }
    product.prices[row.supplier_id].push(price);
  }

  // Calculate supplier totals using most expensive available variant per product
  for (const product of productsMap.values()) {
    for (const [supplierId, pricesArray] of Object.entries(product.prices)) {
      const supplierTotal = supplierTotalsMap.get(supplierId);
      if (!supplierTotal) continue;

      // Find most expensive available variant for this supplier (likely the case/bulk)
      const availableVariants = pricesArray.filter((p) => p.availability_status === 'available');

      if (availableVariants.length > 0) {
        const mostExpensiveVariant = availableVariants.reduce((max, curr) =>
          curr.unit_price > max.unit_price ? curr : max
        );

        supplierTotal.total_cost += mostExpensiveVariant.line_total;
        supplierTotal.products_available += 1;
      }
    }
  }

  // Per-product evaluation — all ranking logic lives in `domain/ranking.ts`.
  // Service layer just feeds inputs in and aggregates the flags out.
  const products: ProductComparison[] = [];
  let maxPotentialSavings = 0;
  let productsOrderIsBest = 0;
  let productsSupplierIsBest = 0;
  let productsBelowThreshold = 0;

  const rankingOptions = { useUnitCost: env.priceCompare.useUnitCost };

  for (const internalProduct of productsMap.values()) {
    const variantsBySupplier = new Map<string, SupplierCandidate[]>();
    for (const [supplierId, pricesArray] of Object.entries(internalProduct.prices)) {
      const available = pricesArray
        .filter((p) => p.availability_status === 'available')
        .map<SupplierCandidate>((p) => ({
          supplierId,
          supplierName: suppliersMap.get(supplierId)?.name ?? 'Unknown',
          supplierProductCode: p.supplier_product_code,
          unitPrice: p.unit_price,
          lineTotal: p.line_total,
          unitCostInclVat: p.unit_cost_incl_vat,
        }));
      if (available.length > 0) variantsBySupplier.set(supplierId, available);
    }

    const result = computeProductEvaluation({
      orderUnitCost: internalProduct.order.unit_cost,
      orderLineCost: internalProduct.order.line_cost,
      variantsBySupplier,
      thresholds,
      options: rankingOptions,
    });

    if (result.flags.orderIsBest) productsOrderIsBest++;
    if (result.flags.supplierIsBest) productsSupplierIsBest++;
    if (result.flags.belowThreshold) productsBelowThreshold++;
    maxPotentialSavings += result.flags.realizedSavings;

    // One structured decision log per product. Makes "why did this product
    // pick X" diagnosable post-hoc, joined by correlation_id (injected by
    // the logger mixin).
    const decision = result.requiresUserPick
      ? 'requires_user_pick'
      : result.flags.orderIsBest
        ? result.flags.belowThreshold
          ? 'below_threshold'
          : 'order_is_best'
        : 'supplier_wins';
    log.debug(
      {
        product_id: internalProduct.product_id,
        article_code: internalProduct.article_code,
        decision,
        winning_supplier_id: result.evaluation.winning_supplier_id,
        winning_price: result.evaluation.winning_price,
        order_unit_cost: internalProduct.order.unit_cost,
        threshold_pct: result.evaluation.threshold_percentage,
        candidates: variantsBySupplier.size,
      },
      'price-check decision'
    );

    // Sort supplier prices by unit_price descending (highest first)
    const sortedPrices: Record<string, SupplierPrice[]> = {};
    for (const [supplierId, pricesArray] of Object.entries(internalProduct.prices)) {
      sortedPrices[supplierId] = [...pricesArray].sort((a, b) => b.unit_price - a.unit_price);
    }

    // Build final ProductComparison
    products.push({
      product_id: internalProduct.product_id,
      article_code: internalProduct.article_code,
      description: internalProduct.description,
      ean_code: internalProduct.ean_code,
      unit_size: internalProduct.unit_size,
      requires_user_pick: result.requiresUserPick,
      order: internalProduct.order,
      supplier_prices: sortedPrices,
      evaluation: result.evaluation,
    });
  }

  // Track "best price wins" per supplier (including local order)
  const bestPriceWinsMap = new Map<
    string,
    {
      supplier_id: string;
      supplier_name: string;
      products_won: number;
      supplier_cost: number;
      order_cost: number;
    }
  >();

  // Initialize for all suppliers
  for (const supplier of suppliers) {
    bestPriceWinsMap.set(supplier.id, {
      supplier_id: supplier.id,
      supplier_name: supplier.name,
      products_won: 0,
      supplier_cost: 0,
      order_cost: 0,
    });
  }

  // Initialize for local order
  bestPriceWinsMap.set('local_order', {
    supplier_id: 'local_order',
    supplier_name: 'Local Order',
    products_won: 0,
    supplier_cost: 0,
    order_cost: 0,
  });

  // Calculate best price wins for each product
  for (const product of products) {
    const orderLineCost = product.order.line_cost;

    if (product.evaluation.order_is_best) {
      // Local order wins this product
      const localOrderWins = bestPriceWinsMap.get('local_order');
      if (localOrderWins) {
        localOrderWins.products_won += 1;
        localOrderWins.supplier_cost += orderLineCost;
        localOrderWins.order_cost += orderLineCost;
      }
    } else if (product.evaluation.winning_supplier_id) {
      // A supplier wins this product
      const supplierWins = bestPriceWinsMap.get(product.evaluation.winning_supplier_id);
      if (supplierWins) {
        supplierWins.products_won += 1;
        // Get the winning supplier's price for this product
        const supplierPrices = product.supplier_prices[product.evaluation.winning_supplier_id];
        if (supplierPrices && supplierPrices.length > 0) {
          // Use the most expensive available variant (same logic as elsewhere)
          const availableVariants = supplierPrices.filter(
            (p) => p.availability_status === 'available'
          );
          if (availableVariants.length > 0) {
            const bestVariant = availableVariants.reduce((max, curr) =>
              curr.unit_price > max.unit_price ? curr : max
            );
            supplierWins.supplier_cost += bestVariant.line_total;
          }
        }
        supplierWins.order_cost += orderLineCost;
      }
    }
  }

  // Calculate matched order value (only for products that were found)
  const matchedOrderValue = products.reduce((sum, p) => sum + p.order.line_cost, 0);

  // Build supplier rankings array for response
  const supplierRankings: SupplierRanking[] = [];

  for (const st of supplierTotalsMap.values()) {
    const winsData = bestPriceWinsMap.get(st.supplier_id);
    const wonProductsSupplierCost = winsData ? Number(winsData.supplier_cost.toFixed(2)) : 0;
    const wonProductsOrderCost = winsData ? Number(winsData.order_cost.toFixed(2)) : 0;
    const savingsOnWonProducts = Number(
      (wonProductsOrderCost - wonProductsSupplierCost).toFixed(2)
    );
    const savingsPercentage =
      wonProductsOrderCost > 0
        ? Number(((savingsOnWonProducts / wonProductsOrderCost) * 100).toFixed(2))
        : 0;

    supplierRankings.push({
      supplier_id: st.supplier_id,
      supplier_name: st.supplier_name,
      products_won: winsData?.products_won ?? 0,
      total_cost_if_all_from_here: Number(st.total_cost.toFixed(2)),
      won_products_supplier_cost: wonProductsSupplierCost,
      won_products_order_cost: wonProductsOrderCost,
      savings_on_won_products: savingsOnWonProducts,
      savings_percentage: savingsPercentage,
    });
  }

  // Add "Local Order" entry as baseline
  const localOrderWinsData = bestPriceWinsMap.get('local_order');
  supplierRankings.push({
    supplier_id: 'local_order',
    supplier_name: 'Local Order',
    products_won: localOrderWinsData?.products_won ?? 0,
    total_cost_if_all_from_here: Number(matchedOrderValue.toFixed(2)),
    won_products_supplier_cost: localOrderWinsData
      ? Number(localOrderWinsData.supplier_cost.toFixed(2))
      : 0,
    won_products_order_cost: localOrderWinsData
      ? Number(localOrderWinsData.order_cost.toFixed(2))
      : 0,
    savings_on_won_products: 0, // No savings - it's the baseline
    savings_percentage: 0,
  });

  // Sort suppliers by savings (highest savings first), then combine with Local Order last
  supplierRankings.sort((a, b) => {
    // Local order always goes last
    if (a.supplier_id === 'local_order') return 1;
    if (b.supplier_id === 'local_order') return -1;
    return b.savings_on_won_products - a.savings_on_won_products;
  });

  // Find best supplier (lowest cost with all products available)
  const totalProductsNeeded = products.length;
  const bestSupplierData = Array.from(supplierTotalsMap.values()).find(
    (st) => st.products_available === totalProductsNeeded
  );

  // Determine recommendation based on product-level comparisons
  let recommendation: 'keep_order' | 'switch_supplier' | 'mixed';
  if (productsSupplierIsBest === 0) {
    recommendation = 'keep_order';
  } else if (productsOrderIsBest === 0) {
    recommendation = 'switch_supplier';
  } else {
    recommendation = 'mixed';
  }

  // Determine best overall option (order vs best supplier)
  let bestOverall: PriceCheckSummary['evaluation_results']['best_overall'] = null;
  if (matchedOrderValue > 0 || bestSupplierData) {
    const bestSupplierTotal = bestSupplierData?.total_cost ?? Number.POSITIVE_INFINITY;
    const orderIsBestOverall = matchedOrderValue <= bestSupplierTotal;

    if (orderIsBestOverall && matchedOrderValue > 0) {
      bestOverall = {
        source: 'order',
        supplier_id: null,
        supplier_name: null,
        total_cost: Number(matchedOrderValue.toFixed(2)),
        savings_vs_order: 0,
      };
    } else if (bestSupplierData) {
      bestOverall = {
        source: 'supplier',
        supplier_id: bestSupplierData.supplier_id,
        supplier_name: bestSupplierData.supplier_name,
        total_cost: Number(bestSupplierData.total_cost.toFixed(2)),
        savings_vs_order: Number((matchedOrderValue - bestSupplierData.total_cost).toFixed(2)),
      };
    }
  }

  // Reconcile submitted articles against reachable ones. Articles present in
  // master_products but with zero supplier_products rows fall through the RPC
  // without appearing in `products`; track them explicitly so the denominator
  // reconciles (submitted = found + not_found + unpriced).
  const submittedArticles = new Set(orderItems.map((i) => i.article_code));
  const notFoundSet = new Set(notFoundCodes);
  const foundArticles = new Set(products.map((p) => p.article_code));
  const unpricedCodes: string[] = [];
  for (const code of submittedArticles) {
    if (!notFoundSet.has(code) && !foundArticles.has(code)) {
      unpricedCodes.push(code);
    }
  }

  // Build summary
  const summary: PriceCheckSummary = {
    counts: {
      total_items_submitted: products.length + notFoundCodes.length + unpricedCodes.length,
      products_found: products.length,
      products_not_found: notFoundCodes,
      products_unpriced: unpricedCodes,
      suppliers_compared: suppliers.length,
    },
    order_totals: {
      total_order_value: Number(totalOrderValue.toFixed(2)),
      matched_order_value: Number(matchedOrderValue.toFixed(2)),
    },
    evaluation_results: {
      products_order_is_best: productsOrderIsBest,
      products_supplier_is_best: productsSupplierIsBest,
      products_below_threshold: productsBelowThreshold,
      max_potential_savings:
        maxPotentialSavings > 0 ? Number(maxPotentialSavings.toFixed(2)) : null,
      recommendation,
      best_overall: bestOverall,
    },
    supplier_rankings: supplierRankings,
    thresholds_applied: Object.fromEntries(thresholds),
  };

  return {
    data_category: 'price_comparison',
    description:
      'All comparisons use threshold logic. Set threshold to 0 for raw price comparison.',
    thresholds_used: thresholdsUsed,
    suppliers,
    supplier_constraints: getSupplierConstraints(),
    products,
    summary,
  };
}
