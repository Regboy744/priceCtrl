import { describe, expect, it } from 'vitest';
import {
  type SupplierCandidate,
  computeProductEvaluation,
  pickRepresentative,
  requiresUserPick,
} from '../ranking.js';

const BARRY = 'b';
const MUSGRAVE = 'm';
const OREILLYS = 'o';

function candidate(
  id: string,
  name: string,
  unitPrice: number,
  unitCostInclVat: number | null,
  overrides: Partial<SupplierCandidate> = {}
): SupplierCandidate {
  return {
    supplierId: id,
    supplierName: name,
    supplierProductCode: `${id}-sku`,
    unitPrice,
    lineTotal: unitPrice * 10,
    unitCostInclVat,
    ...overrides,
  };
}

describe('pickRepresentative', () => {
  it('prefers the variant that has unit_cost_incl_vat', () => {
    const withUnitCost = candidate(BARRY, 'Barry', 12, 1.2);
    const withoutUnitCost = candidate(BARRY, 'Barry', 20, null);
    const picked = pickRepresentative([withoutUnitCost, withUnitCost]);
    expect(picked).toBe(withUnitCost);
  });

  it('falls back to the most expensive when no variant has unit_cost', () => {
    const cheap = candidate(BARRY, 'Barry', 10, null);
    const expensive = candidate(BARRY, 'Barry', 25, null);
    const picked = pickRepresentative([cheap, expensive]);
    expect(picked).toBe(expensive);
  });
});

describe('requiresUserPick', () => {
  it('is never true when useUnitCost is off', () => {
    const mixed = [candidate(BARRY, 'Barry', 10, 1.0), candidate(MUSGRAVE, 'Musgrave', 11, null)];
    expect(requiresUserPick(mixed, false, { useUnitCost: false })).toBe(false);
    expect(requiresUserPick(mixed, true, { useUnitCost: false })).toBe(false);
  });

  it('is true when useUnitCost is on and any supplier lacks unit_cost', () => {
    const mixed = [candidate(BARRY, 'Barry', 10, 1.0), candidate(MUSGRAVE, 'Musgrave', 11, null)];
    expect(requiresUserPick(mixed, false, { useUnitCost: true })).toBe(true);
  });

  it('is true when a supplier has multiple available pack variants', () => {
    const representatives = [
      candidate(BARRY, 'Barry', 10, 1.0),
      candidate(MUSGRAVE, 'Musgrave', 11, 1.1),
    ];
    expect(requiresUserPick(representatives, true, { useUnitCost: true })).toBe(true);
  });

  it('is false when every supplier has unit_cost and single variants', () => {
    const representatives = [
      candidate(BARRY, 'Barry', 10, 1.0),
      candidate(MUSGRAVE, 'Musgrave', 11, 1.1),
    ];
    expect(requiresUserPick(representatives, false, { useUnitCost: true })).toBe(false);
  });
});

describe('computeProductEvaluation', () => {
  const options = { useUnitCost: false };

  it('no suppliers → order wins by default', () => {
    const result = computeProductEvaluation({
      orderUnitCost: 10,
      orderLineCost: 100,
      variantsBySupplier: new Map(),
      thresholds: new Map(),
      options,
    });
    expect(result.evaluation.order_is_best).toBe(true);
    expect(result.evaluation.winning_supplier_id).toBeNull();
    expect(result.evaluation.best_price_source).toBe('order');
    expect(result.requiresUserPick).toBe(false);
    expect(result.flags).toMatchObject({
      orderIsBest: true,
      supplierIsBest: false,
      belowThreshold: false,
      realizedSavings: 0,
    });
  });

  it('single qualifying supplier → that supplier wins', () => {
    const variants = new Map<string, SupplierCandidate[]>([
      [BARRY, [candidate(BARRY, 'Barry', 9, null, { lineTotal: 90 })]],
    ]);
    const result = computeProductEvaluation({
      orderUnitCost: 10,
      orderLineCost: 100,
      variantsBySupplier: variants,
      thresholds: new Map(),
      options,
    });
    expect(result.evaluation.winning_supplier_id).toBe(BARRY);
    expect(result.evaluation.winning_supplier_name).toBe('Barry');
    expect(result.evaluation.winning_price).toBe(9);
    expect(result.evaluation.order_is_best).toBe(false);
    expect(result.evaluation.threshold_met).toBe(true);
    expect(result.evaluation.potential_savings).toBe(10);
    expect(result.flags.realizedSavings).toBe(10);
  });

  it('picks the cheapest qualifying supplier', () => {
    const variants = new Map<string, SupplierCandidate[]>([
      [BARRY, [candidate(BARRY, 'Barry', 9.5, null, { lineTotal: 95 })]],
      [MUSGRAVE, [candidate(MUSGRAVE, 'Musgrave', 8.5, null, { lineTotal: 85 })]],
      [OREILLYS, [candidate(OREILLYS, "O'Reilly", 9, null, { lineTotal: 90 })]],
    ]);
    const result = computeProductEvaluation({
      orderUnitCost: 10,
      orderLineCost: 100,
      variantsBySupplier: variants,
      thresholds: new Map(),
      options,
    });
    expect(result.evaluation.winning_supplier_id).toBe(MUSGRAVE);
    expect(result.evaluation.winning_price).toBe(8.5);
  });

  it('threshold blocks suppliers that are cheap but not cheap enough', () => {
    const variants = new Map<string, SupplierCandidate[]>([
      // Barry: 5% cheaper, needs ≥10% off → fails threshold
      [BARRY, [candidate(BARRY, 'Barry', 9.5, null)]],
    ]);
    const result = computeProductEvaluation({
      orderUnitCost: 10,
      orderLineCost: 100,
      variantsBySupplier: variants,
      thresholds: new Map([[BARRY, 10]]),
      options,
    });
    expect(result.evaluation.winning_supplier_id).toBeNull();
    expect(result.evaluation.order_is_best).toBe(true);
    expect(result.evaluation.threshold_met).toBe(false);
    expect(result.flags.belowThreshold).toBe(true);
  });

  it('when useUnitCost is on and unit_cost is missing, product is ambiguous', () => {
    const variants = new Map<string, SupplierCandidate[]>([
      [BARRY, [candidate(BARRY, 'Barry', 9, 1.0)]],
      [MUSGRAVE, [candidate(MUSGRAVE, 'Musgrave', 8.5, null)]],
    ]);
    const result = computeProductEvaluation({
      orderUnitCost: 10,
      orderLineCost: 100,
      variantsBySupplier: variants,
      thresholds: new Map(),
      options: { useUnitCost: true },
    });
    expect(result.requiresUserPick).toBe(true);
    expect(result.evaluation.winning_supplier_id).toBeNull();
    expect(result.evaluation.order_is_best).toBe(true);
  });

  it('when useUnitCost is on and any supplier has multiple packs, ambiguous', () => {
    const variants = new Map<string, SupplierCandidate[]>([
      [
        BARRY,
        [
          candidate(BARRY, 'Barry', 10, 1.0),
          candidate(BARRY, 'Barry', 12, 1.0, { supplierProductCode: 'b-sku-24' }),
        ],
      ],
      [MUSGRAVE, [candidate(MUSGRAVE, 'Musgrave', 9, 0.9)]],
    ]);
    const result = computeProductEvaluation({
      orderUnitCost: 10,
      orderLineCost: 100,
      variantsBySupplier: variants,
      thresholds: new Map(),
      options: { useUnitCost: true },
    });
    expect(result.requiresUserPick).toBe(true);
  });

  it('when useUnitCost is on, ranks by unit_cost_incl_vat not unit_price', () => {
    // Barry has cheaper case price but worse per-unit.
    // Musgrave has slightly pricier case but better per-unit → should win.
    const variants = new Map<string, SupplierCandidate[]>([
      [BARRY, [candidate(BARRY, 'Barry', 8, 0.85, { lineTotal: 80 })]],
      [MUSGRAVE, [candidate(MUSGRAVE, 'Musgrave', 9, 0.75, { lineTotal: 90 })]],
    ]);
    const result = computeProductEvaluation({
      orderUnitCost: 10,
      orderLineCost: 100,
      variantsBySupplier: variants,
      thresholds: new Map(),
      options: { useUnitCost: true },
    });
    expect(result.evaluation.winning_supplier_id).toBe(MUSGRAVE);
  });

  it('threshold always uses unit_price (case), even when ranking uses unit_cost', () => {
    // Musgrave has best unit_cost but its case price is 9.6 (only 4% off) and
    // threshold demands 10% → fails qualification.
    const variants = new Map<string, SupplierCandidate[]>([
      [BARRY, [candidate(BARRY, 'Barry', 8.5, 0.95, { lineTotal: 85 })]],
      [MUSGRAVE, [candidate(MUSGRAVE, 'Musgrave', 9.6, 0.75, { lineTotal: 96 })]],
    ]);
    const result = computeProductEvaluation({
      orderUnitCost: 10,
      orderLineCost: 100,
      variantsBySupplier: variants,
      thresholds: new Map([
        [BARRY, 10],
        [MUSGRAVE, 10],
      ]),
      options: { useUnitCost: true },
    });
    // Barry is ≥10% off → qualifies. Musgrave is only 4% off → doesn't.
    expect(result.evaluation.winning_supplier_id).toBe(BARRY);
  });

  it('order_unit_cost of 0 disqualifies every supplier (nothing beats free)', () => {
    // Degenerate case: with a 0 order price, required_price_to_win is 0 for
    // every supplier, so no supplier qualifies. Nobody wins.
    const variants = new Map<string, SupplierCandidate[]>([
      [BARRY, [candidate(BARRY, 'Barry', 5, null)]],
    ]);
    const result = computeProductEvaluation({
      orderUnitCost: 0,
      orderLineCost: 0,
      variantsBySupplier: variants,
      thresholds: new Map(),
      options,
    });
    expect(result.evaluation.winning_supplier_id).toBeNull();
    expect(result.evaluation.threshold_met).toBe(false);
    expect(result.flags.orderIsBest).toBe(false);
  });

  it('supplier_price_difference_pct reflects cheapest-vs-order', () => {
    const variants = new Map<string, SupplierCandidate[]>([
      [BARRY, [candidate(BARRY, 'Barry', 7, null, { lineTotal: 70 })]],
    ]);
    const result = computeProductEvaluation({
      orderUnitCost: 10,
      orderLineCost: 100,
      variantsBySupplier: variants,
      thresholds: new Map(),
      options,
    });
    // 30% cheaper
    expect(result.evaluation.supplier_price_difference_pct).toBe(30);
  });
});
