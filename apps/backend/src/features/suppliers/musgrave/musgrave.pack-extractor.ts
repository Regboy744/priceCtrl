/**
 * Extract pack metadata from a Musgrave API product.
 *
 * Musgrave delivers pack data as typed attributes across TWO channels:
 *   - top-level `attributes`        → UCIV (MoneyRO), size (String)
 *   - `attributeGroup.attributes`   → number-of-pack-units (String)
 *
 * We look in both. No string parsing required.
 */

import { EMPTY_PACK_DATA, type PackData } from '../../../shared/services/pack-parser/index.js';
import type { MusgraveApiAttribute, MusgraveApiProduct } from './musgrave.types.js';

interface MoneyValue {
  value?: number;
}

/** The API emits a nested attributeGroup the public type doesn't declare. */
interface MusgraveRawProduct extends MusgraveApiProduct {
  attributeGroup?: { attributes?: MusgraveApiAttribute[] };
}

function findAttribute(
  attrs: readonly MusgraveApiAttribute[] | undefined,
  name: string
): MusgraveApiAttribute | undefined {
  return attrs?.find((a) => a.name === name);
}

export function extractMusgravePackData(product: MusgraveApiProduct): PackData {
  const raw = product as MusgraveRawProduct;
  const top = raw.attributes ?? [];
  const group = raw.attributeGroup?.attributes ?? [];

  if (top.length === 0 && group.length === 0) return { ...EMPTY_PACK_DATA };

  const uciv = findAttribute(top, 'UCIV') ?? findAttribute(group, 'UCIV');
  const packUnits =
    findAttribute(group, 'number-of-pack-units') ?? findAttribute(top, 'number-of-pack-units');
  const size = findAttribute(top, 'size') ?? findAttribute(group, 'size');

  // UCIV is a Money attribute: { type: "Money", value: number, currency: "EUR" }.
  let unitCostInclVat: number | null = null;
  if (uciv?.value && typeof uciv.value === 'object') {
    const money = uciv.value as MoneyValue;
    if (typeof money.value === 'number' && Number.isFinite(money.value)) {
      unitCostInclVat = money.value;
    }
  }

  // number-of-pack-units is a plain String attribute; parse to int.
  let packCount: number | null = null;
  if (typeof packUnits?.value === 'string') {
    const parsed = Number.parseInt(packUnits.value, 10);
    if (Number.isFinite(parsed) && parsed > 0) packCount = parsed;
  }

  const packUnitSize =
    typeof size?.value === 'string' && size.value.trim().length > 0 ? size.value.trim() : null;

  return { unitCostInclVat, packCount, packUnitSize };
}
