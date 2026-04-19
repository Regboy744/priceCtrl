/**
 * Product evaluation — pure domain logic.
 *
 * Given a product's available supplier variants plus per-company thresholds,
 * decides who wins and why. No HTTP, no DB, no side effects — so it can be
 * unit-tested exhaustively and reused by any caller (compare endpoint,
 * recompare, order preview, debug tools).
 *
 * Ranking semantics (matches the behaviour the UI was written against):
 *
 *   1. Pick one representative variant per supplier — the one with an
 *      extracted per-unit cost if any, otherwise the most-expensive variant
 *      (legacy case-level comparison).
 *   2. Ambiguity guard: if the `useUnitCost` flag is on and any supplier is
 *      missing a per-unit cost, OR any supplier has multiple available pack
 *      variants, this product is flagged `requires_user_pick` and no auto-
 *      winner is chosen. The UI prompts the user.
 *   3. Threshold qualification: a supplier's `unit_price` (case) must be at
 *      or below `order_unit_cost × (1 - threshold%)`. Threshold stays on
 *      case price until master_products carries pack data.
 *   4. Winner: cheapest qualifying supplier ranked by `unit_cost_incl_vat`
 *      when `useUnitCost` is on and the field is present, else by
 *      `unit_price`.
 *   5. When no supplier qualifies, the local order wins. If the absolute
 *      cheapest supplier was beneath the order price but no threshold was
 *      met, the product is flagged `below_threshold` (summary counter).
 */

import type { ProductEvaluation } from '../priceCheck.types.js';

/**
 * The representative form of a supplier's offer for a single product.
 * Multiple raw variants collapse into one candidate via `pickRepresentative`.
 */
export interface SupplierCandidate {
  supplierId: string;
  supplierName: string;
  supplierProductCode: string;
  unitPrice: number;
  lineTotal: number;
  unitCostInclVat: number | null;
}

export interface RankingOptions {
  /** When true, prefer unit_cost_incl_vat for ranking and apply ambiguity guard. */
  useUnitCost: boolean;
}

export interface RankingResult {
  evaluation: ProductEvaluation;
  requiresUserPick: boolean;
  /** Aggregate counters — caller sums across all products to build the summary. */
  flags: {
    orderIsBest: boolean;
    supplierIsBest: boolean;
    /** Cheapest supplier beat order price but no supplier qualified. */
    belowThreshold: boolean;
    /** Positive savings contribution when a supplier wins. 0 otherwise. */
    realizedSavings: number;
  };
}

export interface RankingInputs {
  orderUnitCost: number;
  orderLineCost: number;
  /** Available variants per supplier. Empty or absent suppliers are ignored. */
  variantsBySupplier: Map<string, SupplierCandidate[]>;
  /** supplier_id → percentage (0–100). Missing entries default to 0. */
  thresholds: Map<string, number>;
  options: RankingOptions;
}

/**
 * Pick one variant per supplier for ranking purposes. Prefers the variant
 * exposing `unit_cost_incl_vat` — the supplier's own per-unit math — so
 * cross-supplier comparisons stay apples-to-apples. Falls back to the most
 * expensive variant for suppliers whose pack data hasn't been baselined.
 */
export function pickRepresentative(variants: SupplierCandidate[]): SupplierCandidate {
  const withUnitCost = variants.find((v) => v.unitCostInclVat !== null);
  if (withUnitCost) return withUnitCost;
  return variants.reduce((max, curr) => (curr.unitPrice > max.unitPrice ? curr : max));
}

/**
 * True when the ranking algorithm can't safely auto-pick a winner and the
 * user must choose. See module doc, step 2.
 */
export function requiresUserPick(
  representatives: SupplierCandidate[],
  anySupplierHasMultiplePacks: boolean,
  options: RankingOptions
): boolean {
  if (!options.useUnitCost) return false;
  const allHaveUnitCost =
    representatives.length > 0 && representatives.every((p) => p.unitCostInclVat !== null);
  return !allHaveUnitCost || anySupplierHasMultiplePacks;
}

/**
 * Core per-product evaluation. Pure function — same inputs produce same
 * output. Branches: no suppliers, ambiguous, ranked.
 */
export function computeProductEvaluation(inputs: RankingInputs): RankingResult {
  const { orderUnitCost, orderLineCost, variantsBySupplier, thresholds, options } = inputs;

  const representatives: SupplierCandidate[] = [];
  let anySupplierHasMultiplePacks = false;
  for (const variants of variantsBySupplier.values()) {
    if (variants.length === 0) continue;
    if (variants.length > 1) anySupplierHasMultiplePacks = true;
    representatives.push(pickRepresentative(variants));
  }

  // Branch 1: no suppliers available — order wins by default.
  if (representatives.length === 0) {
    return {
      evaluation: neutralEvaluation(orderUnitCost),
      requiresUserPick: false,
      flags: {
        orderIsBest: orderUnitCost > 0,
        supplierIsBest: false,
        belowThreshold: false,
        realizedSavings: 0,
      },
    };
  }

  // Branch 2: ambiguous — no auto-pick, UI prompts user.
  if (requiresUserPick(representatives, anySupplierHasMultiplePacks, options)) {
    return {
      evaluation: neutralEvaluation(orderUnitCost),
      requiresUserPick: true,
      flags: {
        orderIsBest: orderUnitCost > 0,
        supplierIsBest: false,
        belowThreshold: false,
        realizedSavings: 0,
      },
    };
  }

  // Branch 3: rank the candidates.
  const compareOf = (p: SupplierCandidate): number =>
    options.useUnitCost && p.unitCostInclVat !== null ? p.unitCostInclVat : p.unitPrice;

  const cheapestSupplier = representatives.reduce((min, curr) =>
    compareOf(curr) < compareOf(min) ? curr : min
  );

  const qualifyingSuppliers = representatives.filter((price) => {
    const threshold = thresholds.get(price.supplierId) ?? 0;
    const requiredPrice = orderUnitCost * (1 - threshold / 100);
    return price.unitPrice <= requiredPrice;
  });

  const winningSupplier =
    qualifyingSuppliers.length > 0
      ? qualifyingSuppliers.reduce((min, curr) => (compareOf(curr) < compareOf(min) ? curr : min))
      : null;

  const orderIsBest = orderUnitCost > 0 && !winningSupplier;
  const relevantSupplier = winningSupplier ?? cheapestSupplier;
  const threshold = thresholds.get(relevantSupplier.supplierId) ?? 0;
  const requiredPrice = orderUnitCost * (1 - threshold / 100);
  const priceDiff = orderUnitCost - cheapestSupplier.unitPrice;
  const actualDifferencePct = orderUnitCost > 0 ? (priceDiff / orderUnitCost) * 100 : 0;

  const evaluation: ProductEvaluation = {
    winning_supplier_id: orderIsBest ? null : (winningSupplier?.supplierId ?? null),
    winning_supplier_name: orderIsBest ? null : (winningSupplier?.supplierName ?? null),
    winning_price: orderIsBest ? orderUnitCost : (winningSupplier?.unitPrice ?? null),
    order_is_best: orderIsBest,
    best_price_source: orderIsBest ? 'order' : 'supplier',
    potential_savings: orderIsBest
      ? null
      : Number((orderLineCost - (winningSupplier?.lineTotal ?? 0)).toFixed(2)),
    threshold_percentage: threshold,
    required_price_to_win: Number(requiredPrice.toFixed(2)),
    supplier_price_difference_pct: Number(actualDifferencePct.toFixed(2)),
    threshold_met: !!winningSupplier,
  };

  let realizedSavings = 0;
  if (winningSupplier && orderLineCost > 0) {
    const actualSavings = orderLineCost - winningSupplier.lineTotal;
    if (actualSavings > 0) realizedSavings = actualSavings;
  }

  return {
    evaluation,
    requiresUserPick: false,
    flags: {
      orderIsBest,
      supplierIsBest: !orderIsBest,
      belowThreshold:
        orderIsBest &&
        cheapestSupplier.unitPrice < orderUnitCost &&
        qualifyingSuppliers.length === 0,
      realizedSavings,
    },
  };
}

/** Shape used for "no suppliers" and "ambiguous" branches. */
function neutralEvaluation(orderUnitCost: number): ProductEvaluation {
  return {
    winning_supplier_id: null,
    winning_supplier_name: null,
    winning_price: orderUnitCost > 0 ? orderUnitCost : null,
    order_is_best: orderUnitCost > 0,
    best_price_source: orderUnitCost > 0 ? 'order' : null,
    potential_savings: null,
    threshold_percentage: 0,
    required_price_to_win: orderUnitCost,
    supplier_price_difference_pct: 0,
    threshold_met: false,
  };
}
