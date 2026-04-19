import type { FieldTransformer } from '../types/transformer.types.js';

/**
 * Direct EAN transformer for when EAN is extracted directly from DOM or via pattern.
 * Validates that the value looks like an EAN code (digits only, configurable length).
 *
 * Use this with extraction pattern to extract EAN from image URLs or other sources:
 * @example
 * // Extraction config
 * { key: 'ean', strategies: [
 *   { type: 'attribute', selector: 'img', attribute: 'src', pattern: '/(\\d{5,14})t\\.jpg' }
 * ]}
 *
 * // Transformer config
 * ean: directEanTransformer({ minLength: 5 })
 */
export function directEanTransformer(options?: {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
}): FieldTransformer<string> {
  const minLength = options?.minLength ?? 8;
  const maxLength = options?.maxLength ?? 14;

  return {
    required: options?.required ?? true,
    validate: (raw) => {
      if (typeof raw !== 'string') return false;
      const cleaned = raw.trim();
      return cleaned.length >= minLength && cleaned.length <= maxLength && /^\d+$/.test(cleaned);
    },
    transform: (raw) => {
      const cleaned = String(raw).trim();
      if (!/^\d+$/.test(cleaned)) return null;
      if (cleaned.length < minLength || cleaned.length > maxLength) return null;
      return cleaned;
    },
  };
}
