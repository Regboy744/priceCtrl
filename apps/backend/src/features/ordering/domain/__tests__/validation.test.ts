import type { SupplierConstraint } from '@pricectrl/contracts/priceCheck';
import { describe, expect, it } from 'vitest';
import type { OrderSubmissionRequest } from '../../ordering.types.js';
import { validateSubmission } from '../validation.js';

const BARRY = '11111111-1111-1111-1111-111111111111';
const SW = '22222222-2222-2222-2222-222222222222';
const COMPANY = '33333333-3333-3333-3333-333333333333';
const LOCATION = '44444444-4444-4444-4444-444444444444';
const PRODUCT_A = '55555555-5555-5555-5555-555555555555';

function item(overrides: {
  supplier_product_code?: string;
  quantity?: number;
  product_id?: string;
  master_product_id?: string;
  unit_price?: number;
  baseline_unit_price?: number;
}) {
  return {
    supplier_product_code: overrides.supplier_product_code ?? 'CODE-1',
    quantity: overrides.quantity ?? 1,
    product_id: overrides.product_id,
    master_product_id: overrides.master_product_id ?? PRODUCT_A,
    unit_price: overrides.unit_price ?? 5,
    baseline_unit_price: overrides.baseline_unit_price ?? 6,
  };
}

function request(args: {
  supplierId: string;
  items: ReturnType<typeof item>[];
}): OrderSubmissionRequest {
  return {
    company_id: COMPANY,
    location_id: LOCATION,
    supplier_orders: [{ supplier_id: args.supplierId, items: args.items }],
  };
}

describe('validateSubmission', () => {
  it('returns no warnings when no constraints are provided', () => {
    const warnings = validateSubmission({
      request: request({ supplierId: BARRY, items: [item({})] }),
      constraints: new Map(),
    });
    expect(warnings).toEqual([]);
  });

  it('returns no warnings when the supplier has no product_id requirement', () => {
    const constraints = new Map<string, SupplierConstraint>([
      [BARRY, { requires_internal_product_id: false }],
    ]);
    const warnings = validateSubmission({
      request: request({ supplierId: BARRY, items: [item({})] }),
      constraints,
    });
    expect(warnings).toEqual([]);
  });

  it('flags items missing product_id when the supplier requires it', () => {
    const constraints = new Map<string, SupplierConstraint>([
      [SW, { requires_internal_product_id: true }],
    ]);
    const warnings = validateSubmission({
      request: request({
        supplierId: SW,
        items: [item({ product_id: undefined }), item({ product_id: 'abc' })],
      }),
      constraints,
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      code: 'missing_internal_product_id',
      severity: 'error',
      supplier_id: SW,
      item_count: 1,
    });
  });

  it('emits no warning when all items have product_id', () => {
    const constraints = new Map<string, SupplierConstraint>([
      [SW, { requires_internal_product_id: true }],
    ]);
    const warnings = validateSubmission({
      request: request({
        supplierId: SW,
        items: [item({ product_id: 'a' }), item({ product_id: 'b' })],
      }),
      constraints,
    });
    expect(warnings).toEqual([]);
  });

  it('accumulates warnings across multiple supplier orders', () => {
    const constraints = new Map<string, SupplierConstraint>([
      [BARRY, { requires_internal_product_id: false }],
      [SW, { requires_internal_product_id: true }],
    ]);
    const req: OrderSubmissionRequest = {
      company_id: COMPANY,
      location_id: LOCATION,
      supplier_orders: [
        { supplier_id: BARRY, items: [item({ product_id: undefined })] },
        { supplier_id: SW, items: [item({ product_id: undefined })] },
      ],
    };
    const warnings = validateSubmission({ request: req, constraints });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.supplier_id).toBe(SW);
  });
});
