import type { FieldTransformer } from '../types/transformer.types.js';

/**
 * VAT rate transformer - extracts percentage from string.
 * Handles formats like "VAT Rate : 23%", "23%", "23", "0.23"
 *
 * @param asDecimal - If true, returns decimal (0.23), otherwise percentage (23)
 */
export function vatRateTransformer(asDecimal = false): FieldTransformer<number> {
  return {
    required: false,
    default: 0,
    validate: (raw) => typeof raw === 'string' || typeof raw === 'number',
    transform: (raw) => {
      if (typeof raw === 'number') {
        // If already a number, check if it looks like a decimal or percentage
        if (raw > 0 && raw < 1) {
          return asDecimal ? raw : raw * 100;
        }
        return asDecimal ? raw / 100 : raw;
      }

      const match = String(raw).match(/(\d+(?:\.\d+)?)/);
      if (!match) return null;

      const value = Number.parseFloat(match[1]);
      if (Number.isNaN(value)) return null;

      // If value is small (< 1), it's probably already a decimal
      if (value > 0 && value < 1) {
        return asDecimal ? value : value * 100;
      }

      // Otherwise it's a percentage
      return asDecimal ? value / 100 : value;
    },
  };
}
