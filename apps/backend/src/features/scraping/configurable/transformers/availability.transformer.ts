import type {
  AvailabilityStatus,
  AvailabilityTransformerOptions,
  FieldTransformer,
} from '../types/transformer.types.js';

/**
 * Availability transformer - maps text to standard availability status.
 *
 * @param mapping - Map of lowercase text patterns to status
 * @param options - Transformer options
 */
export function availabilityTransformer(
  mapping: Record<string, AvailabilityStatus>,
  options?: AvailabilityTransformerOptions
): FieldTransformer<AvailabilityStatus> {
  const defaultWhenMissing = options?.defaultWhenMissing ?? 'available';
  const defaultWhenUnmapped = options?.defaultWhenUnmapped ?? 'unknown';

  return {
    required: false,
    default: defaultWhenMissing,
    validate: () => true, // Always valid, we handle missing/unknown gracefully
    transform: (raw) => {
      // No value = use default (usually 'available' for sites that hide unavailable products)
      if (raw === null || raw === undefined || String(raw).trim() === '') {
        return defaultWhenMissing;
      }

      const normalized = String(raw).toLowerCase().trim();

      // Check for exact matches first
      if (mapping[normalized]) {
        return mapping[normalized];
      }

      // Then check for partial matches (contains)
      for (const [key, value] of Object.entries(mapping)) {
        if (normalized.includes(key)) {
          return value;
        }
      }

      // Text exists but not mapped
      return defaultWhenUnmapped;
    },
  };
}

/**
 * Common availability mapping that works for most suppliers.
 */
export const COMMON_AVAILABILITY_MAPPING: Record<string, AvailabilityStatus> = {
  // Available states
  available: 'available',
  'in stock': 'available',
  'low stock': 'available',
  'while stocks last': 'available',

  // Out of stock states
  'out of stock': 'out_of_stock',
  unavailable: 'out_of_stock',
  'currently unavailable': 'out_of_stock',
  'not available': 'out_of_stock',
  'temporarily unavailable': 'out_of_stock',

  // Discontinued states
  discontinued: 'discontinued',
  delisted: 'discontinued',
};
