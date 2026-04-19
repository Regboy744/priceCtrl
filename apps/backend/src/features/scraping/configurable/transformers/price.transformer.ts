import type { FieldTransformer } from '../types/transformer.types.js';

/**
 * Price transformer - extracts numeric price from string.
 * Handles formats like "€12.34", "12.34", "€1,234.56", "$99.99"
 */
export const priceTransformer: FieldTransformer<number> = {
  required: true,
  validate: (raw) => typeof raw === 'string' && raw.trim().length > 0,
  transform: (raw) => {
    const cleaned = String(raw)
      .replace(/[€$£¥₹EUR]/gi, '')
      .replace(/\s/g, '')
      .replace(',', '.'); // Handle European comma decimal

    const price = Number.parseFloat(cleaned);
    return Number.isNaN(price) || price <= 0 ? null : price;
  },
};

/**
 * Create a custom price transformer with options.
 */
export function createPriceTransformer(options?: {
  required?: boolean;
  allowZero?: boolean;
}): FieldTransformer<number> {
  return {
    required: options?.required ?? true,
    default: 0,
    validate: (raw) => typeof raw === 'string' && raw.trim().length > 0,
    transform: (raw) => {
      const cleaned = String(raw)
        .replace(/[€$£¥₹EUR]/gi, '')
        .replace(/\s/g, '')
        .replace(',', '.');

      const price = Number.parseFloat(cleaned);
      if (Number.isNaN(price)) return null;
      if (!options?.allowZero && price <= 0) return null;
      return price;
    },
  };
}
