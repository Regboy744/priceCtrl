import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  PriceCheckRequestSchema,
  PriceCheckResponseSchema,
  SupplierConstraintSchema,
  ValidationWarningSchema,
} from '../schemas.js';

/**
 * Contract tests — parse a real backend response through each schema.
 * If the backend ever drifts from the declared shape, these fail in
 * the contracts repo's CI before the drift reaches the frontend.
 */

const fixturePath = fileURLToPath(
  new URL('../../../fixtures/compare-response.sample.json', import.meta.url)
);

describe('PriceCheckResponseSchema', () => {
  it('parses a real /price-check/compare response', () => {
    const fixture: unknown = JSON.parse(readFileSync(fixturePath, 'utf-8'));
    const result = PriceCheckResponseSchema.safeParse(fixture);
    if (!result.success) {
      // Surface the first few issues so a breaking change is obvious.
      const preview = result.error.issues.slice(0, 5).map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      throw new Error(
        `Schema drift detected.\n${JSON.stringify(preview, null, 2)}`
      );
    }
    expect(result.success).toBe(true);
  });

  it('requires supplier_constraints on the response', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8'));
    const withoutConstraints = { ...fixture };
    delete (withoutConstraints as Record<string, unknown>).supplier_constraints;
    const result = PriceCheckResponseSchema.safeParse(withoutConstraints);
    expect(result.success).toBe(false);
  });
});

describe('PriceCheckRequestSchema', () => {
  it('accepts a valid request with optional supplier_ids', () => {
    const result = PriceCheckRequestSchema.safeParse({
      company_id: 'a8b751cd-478a-4dc8-bb07-1c00dc60b733',
      items: [
        { article_code: '1234567 001', quantity: 2, unit_cost: 5.5 },
      ],
      supplier_ids: ['d9b27313-c486-4ad9-bc1a-5475886f8f87'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty items', () => {
    const result = PriceCheckRequestSchema.safeParse({
      company_id: 'a8b751cd-478a-4dc8-bb07-1c00dc60b733',
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-UUID company_id', () => {
    const result = PriceCheckRequestSchema.safeParse({
      company_id: 'not-a-uuid',
      items: [{ article_code: 'x', quantity: 1, unit_cost: 1 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-positive quantity', () => {
    const result = PriceCheckRequestSchema.safeParse({
      company_id: 'a8b751cd-478a-4dc8-bb07-1c00dc60b733',
      items: [{ article_code: 'x', quantity: 0, unit_cost: 1 }],
    });
    expect(result.success).toBe(false);
  });
});

describe('SupplierConstraintSchema', () => {
  it('accepts a constraint with the required flag', () => {
    expect(
      SupplierConstraintSchema.safeParse({ requires_internal_product_id: true }).success
    ).toBe(true);
  });

  it('accepts an optional max_items_per_request', () => {
    expect(
      SupplierConstraintSchema.safeParse({
        requires_internal_product_id: false,
        max_items_per_request: 32,
      }).success
    ).toBe(true);
  });

  it('rejects negative max_items_per_request', () => {
    expect(
      SupplierConstraintSchema.safeParse({
        requires_internal_product_id: false,
        max_items_per_request: -1,
      }).success
    ).toBe(false);
  });
});

describe('ValidationWarningSchema', () => {
  it('accepts a structured warning', () => {
    expect(
      ValidationWarningSchema.safeParse({
        code: 'missing_internal_product_id',
        severity: 'error',
        message: 'human readable',
        supplier_id: 'x',
        item_count: 3,
      }).success
    ).toBe(true);
  });

  it('rejects unknown severities', () => {
    expect(
      ValidationWarningSchema.safeParse({
        code: 'x',
        severity: 'critical',
        message: 'y',
      }).success
    ).toBe(false);
  });
});
